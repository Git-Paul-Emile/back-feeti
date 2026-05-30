/**
 * ═══════════════════════════════════════════════════════════════════════
 *  SERVICE DE GESTION DES TRANSACTIONS FINANCIÈRES
 *  State Machine ACID avec Event Sourcing
 * ═══════════════════════════════════════════════════════════════════════
 */

import { StatusCodes } from "http-status-codes";
import { randomUUID } from "crypto";
import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/database.js";
import {
  calculerRepartitionFinanciere,
  genererChecksum,
  pourcentToBP,
} from "../utils/financial.js";
import { transactionRepository } from "../repositories/transaction.repository.js";
import { walletService } from "./wallet.service.js";
import { auditService } from "./audit.service.js";
import type { TransactionStatus } from "../generated/prisma/client.js";

// ─── Lecture des taux configurés en base ─────────────────────────────
export async function lireTauxConfigures(): Promise<{ tauxTVA_bp: number; tauxCommission_bp: number }> {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: ["tvaRate", "commissionRate"] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  const tva = parseFloat(map["tvaRate"] ?? "18");
  const comm = parseFloat(map["commissionRate"] ?? "10");
  return {
    tauxTVA_bp: pourcentToBP(isFinite(tva) ? tva : 18),
    tauxCommission_bp: pourcentToBP(isFinite(comm) ? comm : 10),
  };
}

// ─── Machine à états des transitions autorisées ───────────────────────
const ALLOWED_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  pending:            ["processing", "failed", "cancelled"],
  processing:         ["paid", "failed"],
  paid:               ["completed", "refunded", "partially_refunded", "disputed"],
  completed:          ["disputed"],
  failed:             [],
  refunded:           [],
  partially_refunded: ["refunded", "disputed"],
  disputed:           ["completed", "refunded"],
  cancelled:          [],
};

function assertTransitionAllowed(from: TransactionStatus, to: TransactionStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AppError(
      `Transition d'état invalide: ${from} → ${to}. ` +
      `Transitions autorisées depuis '${from}': [${allowed.join(", ") || "aucune"}]`,
      StatusCodes.UNPROCESSABLE_ENTITY
    );
  }
}

// ─── Service ──────────────────────────────────────────────────────────
export const transactionService = {

  /**
   * Crée une transaction financière pour un achat de billet.
   * Opération atomique ACID — rollback complet en cas d'erreur.
   */
  async creerTransaction(data: {
    idempotencyKey: string;
    eventId: string;
    organizerId: string;
    buyerId: string;
    ticketId: string;
    prixTTCCentimes: number;
    devise: string;
    paymentMethod?: string;
    metadata?: Record<string, unknown>;
    actorIp?: string;
    actorUserAgent?: string;
  }) {
    // Vérification idempotence — évite les doublons
    const existing = await transactionRepository.findByIdempotencyKey(data.idempotencyKey);
    if (existing) {
      return existing;
    }

    // Vérifier si ce ticket a déjà une transaction
    const existingTicketTx = await transactionRepository.findByTicketId(data.ticketId);
    if (existingTicketTx) {
      throw new AppError(
        `Une transaction existe déjà pour le billet ${data.ticketId}`,
        StatusCodes.CONFLICT
      );
    }

    // Lecture des taux configurés (DB) avec fallback sur les constantes
    const { tauxTVA_bp, tauxCommission_bp } = await lireTauxConfigures();

    // Calcul financier déterministe
    const repartition = calculerRepartitionFinanciere(
      data.prixTTCCentimes,
      tauxTVA_bp,
      tauxCommission_bp
    );

    // Checksum d'intégrité
    const checksum = genererChecksum({
      idempotencyKey: data.idempotencyKey,
      ticketId: data.ticketId,
      montantTTC: repartition.prixTTC,
      montantHT: repartition.prixHT,
      tva: repartition.tva,
      commission: repartition.commission,
      netOrganisateur: repartition.netOrganisateur,
      tauxTVA: repartition.tauxTVA,
      tauxCommission: repartition.tauxCommission,
    });

    // Transaction Prisma ACID
    return prisma.$transaction(async (tx) => {
      // Créer la transaction financière
      const transaction = await tx.transaction.create({
        data: {
          idempotencyKey: data.idempotencyKey,
          eventId: data.eventId,
          organizerId: data.organizerId,
          buyerId: data.buyerId,
          ticketId: data.ticketId,
          montantTTC: repartition.prixTTC,
          montantHT: repartition.prixHT,
          tva: repartition.tva,
          commission: repartition.commission,
          netOrganisateur: repartition.netOrganisateur,
          devise: data.devise,
          tauxTVA: repartition.tauxTVA,
          tauxCommission: repartition.tauxCommission,
          paymentMethod: data.paymentMethod,
          metadata: (data.metadata ?? {}) as object,
          checksum,
        },
      });

      // Event Sourcing — enregistrer la création
      await tx.transactionStatusHistory.create({
        data: {
          transactionId: transaction.id,
          toStatus: "pending",
          reason: "Transaction créée",
          actorId: data.buyerId,
          actorRole: "user",
        },
      });

      // Initialiser le wallet de l'organisateur si inexistant
      const wallet = await tx.wallet.upsert({
        where: { organizerId: data.organizerId },
        create: {
          organizerId: data.organizerId,
          devise: data.devise,
          soldeEnAttente: repartition.netOrganisateur,
          checksum: "",
        },
        update: {
          soldeEnAttente: { increment: repartition.netOrganisateur },
          version: { increment: 1 },
        },
      });

      // Entrée ledger — crédit en attente
      const checksumLedger = genererChecksum({
        walletId: wallet.id,
        entryType: "credit",
        operationType: "ticket_purchase",
        amount: repartition.netOrganisateur,
        referenceId: transaction.id,
      });

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          entryType: "credit",
          operationType: "ticket_purchase",
          amount: repartition.netOrganisateur,
          balanceBefore: wallet.soldeDisponible,
          balanceAfter: wallet.soldeDisponible, // pas encore disponible
          description: `Gain en attente — billet ${data.ticketId}`,
          referenceId: transaction.id,
          referenceType: "transaction",
          actorId: data.buyerId,
          checksum: checksumLedger,
        },
      });

      return transaction;
    });
  },

  /**
   * Effectue une transition d'état validée avec audit complet.
   */
  async changerStatut(
    transactionId: string,
    newStatus: TransactionStatus,
    actor: { id: string; role: string; ip?: string; userAgent?: string },
    options?: {
      reason?: string;
      refundAmount?: number;
      refundReason?: string;
      paymentProviderTransactionId?: string;
    }
  ) {
    const transaction = await transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new AppError("Transaction introuvable", StatusCodes.NOT_FOUND);
    }

    const oldStatus = transaction.status;
    assertTransitionAllowed(oldStatus, newStatus);

    return prisma.$transaction(async (tx) => {
      // Mettre à jour le statut
      const completedAt = newStatus === "completed" ? new Date() : undefined;

      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: newStatus,
          ...(completedAt && { completedAt }),
          ...(options?.refundAmount !== undefined && { refundAmount: options.refundAmount }),
          ...(options?.refundReason && { refundReason: options.refundReason }),
          ...(options?.paymentProviderTransactionId && {
            paymentProviderTransactionId: options.paymentProviderTransactionId,
          }),
        },
      });

      // Event Sourcing — enregistrer la transition
      await tx.transactionStatusHistory.create({
        data: {
          transactionId,
          fromStatus: oldStatus,
          toStatus: newStatus,
          reason: options?.reason,
          actorId: actor.id,
          actorRole: actor.role,
        },
      });

      // Effets sur le wallet selon la transition
      await transactionService._appliquerEffetWallet(tx, updated, oldStatus, newStatus, options);

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          userRole: actor.role,
          action: "TRANSACTION_STATUS_CHANGE",
          resource: "Transaction",
          resourceId: transactionId,
          ipAddress: actor.ip,
          userAgent: actor.userAgent,
          dataBefore: { status: oldStatus },
          dataAfter: { status: newStatus, ...options },
          checksum: genererChecksum({
            transactionId,
            fromStatus: oldStatus,
            toStatus: newStatus,
            actorId: actor.id,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      return updated;
    });
  },

  /** Applique les effets sur le wallet lors d'une transition */
  async _appliquerEffetWallet(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    transaction: { id: string; eventId: string; organizerId: string; netOrganisateur: number; refundAmount?: number | null },
    oldStatus: TransactionStatus,
    newStatus: TransactionStatus,
    options?: { refundAmount?: number }
  ) {
    const wallet = await tx.wallet.findUnique({
      where: { organizerId: transaction.organizerId },
    });
    if (!wallet) return;

    const net = transaction.netOrganisateur;

    if (newStatus === "completed") {
      // pending/processing/paid → completed : déplacer de enAttente vers disponible
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          soldeDisponible: { increment: net },
          soldeRetirable: { increment: net },
          soldeTotal: { increment: net },
          soldeEnAttente: { decrement: net },
          version: { increment: 1 },
        },
      });

      const checksumLedger = genererChecksum({
        walletId: wallet.id,
        type: "complete",
        amount: net,
        txId: transaction.id,
        ts: new Date().toISOString(),
      });

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          entryType: "credit",
          operationType: "ticket_purchase",
          amount: net,
          balanceBefore: wallet.soldeDisponible,
          balanceAfter: wallet.soldeDisponible + net,
          description: `Gain confirmé — transaction ${transaction.id}`,
          referenceId: transaction.id,
          referenceType: "transaction",
          checksum: checksumLedger,
        },
      });

      // Déduire automatiquement le coût d'une promotion "sur les ventes" si en attente
      await transactionService._deduirePromotionSurVente(
        tx,
        transaction.eventId,
        transaction.organizerId,
        wallet.id,
        wallet.soldeDisponible + net
      );
    }

    if (newStatus === "refunded" && oldStatus !== "pending") {
      const refundNet = options?.refundAmount ?? net;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          soldeDisponible: { decrement: refundNet },
          soldeRetirable: { decrement: refundNet },
          soldeTotal: { decrement: refundNet },
          version: { increment: 1 },
        },
      });

      const checksumLedger = genererChecksum({
        walletId: wallet.id,
        type: "refund",
        amount: refundNet,
        txId: transaction.id,
      });

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          entryType: "debit",
          operationType: "refund",
          amount: refundNet,
          balanceBefore: wallet.soldeDisponible,
          balanceAfter: wallet.soldeDisponible - refundNet,
          description: `Remboursement — transaction ${transaction.id}`,
          referenceId: transaction.id,
          referenceType: "transaction",
          checksum: checksumLedger,
        },
      });
    }

    if (newStatus === "failed" || newStatus === "cancelled") {
      // Annuler le crédit en attente
      const pending = Math.min(net, wallet.soldeEnAttente);
      if (pending > 0) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            soldeEnAttente: { decrement: pending },
            version: { increment: 1 },
          },
        });
      }
    }

    if (newStatus === "disputed") {
      // Bloquer le montant pour litige
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          soldeDisponible: { decrement: net },
          soldeRetirable: { decrement: net },
          totalEnLitige: { increment: net },
          version: { increment: 1 },
        },
      });
    }
  },

  /** Déduit automatiquement le coût d'une promotion "sur les ventes" du wallet */
  async _deduirePromotionSurVente(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    eventId: string,
    organizerId: string,
    walletId: string,
    soldeApresCredit: number
  ) {
    const promo = await tx.promotionPurchase.findFirst({
      where: {
        eventId,
        organizerId,
        paymentMode: "on_sales",
        paymentStatus: "pending",
      },
    });
    if (!promo) return;

    const restant = promo.pricePaid - promo.amountDeducted;
    const toDeduct = Math.min(restant, soldeApresCredit);
    if (toDeduct <= 0) return;

    const newAmountDeducted = promo.amountDeducted + toDeduct;
    const isFullyPaid = newAmountDeducted >= promo.pricePaid;

    await tx.wallet.update({
      where: { id: walletId },
      data: {
        soldeDisponible: { decrement: toDeduct },
        soldeRetirable: { decrement: toDeduct },
        soldeTotal: { decrement: toDeduct },
        version: { increment: 1 },
      },
    });

    const checksumPromo = genererChecksum({
      walletId,
      type: "promotion_deduction",
      amount: toDeduct,
      promoId: promo.id,
      ts: new Date().toISOString(),
    });

    await tx.walletLedger.create({
      data: {
        walletId,
        entryType: "debit",
        operationType: "promotion_deduction",
        amount: toDeduct,
        balanceBefore: soldeApresCredit,
        balanceAfter: soldeApresCredit - toDeduct,
        description: `Déduction promotion ${promo.packType} (sur ventes) — événement ${eventId}`,
        referenceId: promo.id,
        referenceType: "promotion",
        checksum: checksumPromo,
      },
    });

    await tx.promotionPurchase.update({
      where: { id: promo.id },
      data: {
        amountDeducted: newAmountDeducted,
        paymentStatus: isFullyPaid ? "deducted" : "pending",
        status: isFullyPaid ? "completed" : "pending_payment",
      },
    });
  },

  async getTransactionById(id: string, userId: string, userRole: string) {
    const transaction = await transactionRepository.findById(id);
    if (!transaction) throw new AppError("Transaction introuvable", StatusCodes.NOT_FOUND);

    const isAdmin = ["admin", "super_admin"].includes(userRole);
    const isOrganizer = userRole === "organizer" && transaction.organizerId === userId;
    const isBuyer = transaction.buyerId === userId;

    if (!isAdmin && !isOrganizer && !isBuyer) {
      throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
    }

    return transaction;
  },

  async listerTransactions(
    filters: Parameters<typeof transactionRepository.findMany>[0],
    userId: string,
    userRole: string
  ) {
    const isAdmin = ["admin", "super_admin"].includes(userRole);
    if (!isAdmin) {
      // Les organisateurs ne voient que leurs propres transactions
      if (userRole === "organizer") {
        filters.organizerId = userId;
      } else {
        filters.buyerId = userId;
      }
    }
    return transactionRepository.findMany(filters);
  },

  async confirmerPaiement(
    transactionId: string,
    providerTransactionId: string,
    actor: { id: string; role: string }
  ) {
    return transactionService.changerStatut(transactionId, "paid", actor, {
      reason: "Paiement confirmé par le provider",
      paymentProviderTransactionId: providerTransactionId,
    });
  },

  async completerTransaction(
    transactionId: string,
    actor: { id: string; role: string; ip?: string; userAgent?: string }
  ) {
    return transactionService.changerStatut(transactionId, "completed", actor, {
      reason: "Transaction finalisée",
    });
  },

  async initierRemboursement(
    transactionId: string,
    montantRemboursement: number,
    raison: string,
    actor: { id: string; role: string; ip?: string; userAgent?: string }
  ) {
    const transaction = await transactionRepository.findById(transactionId);
    if (!transaction) throw new AppError("Transaction introuvable", StatusCodes.NOT_FOUND);

    if (montantRemboursement > transaction.montantTTC) {
      throw new AppError(
        `Montant du remboursement (${montantRemboursement}) > TTC (${transaction.montantTTC})`,
        StatusCodes.BAD_REQUEST
      );
    }

    const isPartial = montantRemboursement < transaction.montantTTC;
    const newStatus: TransactionStatus = isPartial ? "partially_refunded" : "refunded";

    return transactionService.changerStatut(transactionId, newStatus, actor, {
      reason: raison,
      refundAmount: montantRemboursement,
      refundReason: raison,
    });
  },
};
