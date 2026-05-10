/**
 * ═══════════════════════════════════════════════════════════════════════
 *  SERVICE PAYOUT — Versements aux organisateurs
 *  Double validation admin, traçabilité complète, ledger obligatoire
 * ═══════════════════════════════════════════════════════════════════════
 */

import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/database.js";
import { genererChecksum, formatMontant } from "../utils/financial.js";
import { payoutRepository } from "../repositories/payout.repository.js";
import { walletRepository } from "../repositories/wallet.repository.js";
import type { PayoutStatus } from "../generated/prisma/client.js";

// Seuil de double validation (en centimes) — configurable via env
const PAYOUT_DOUBLE_VALIDATION_THRESHOLD =
  parseInt(process.env.PAYOUT_DOUBLE_VALIDATION_THRESHOLD ?? "500000", 10); // 5 000 XOF

// Machine à états des payouts
const PAYOUT_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  initiated:  ["approved", "failed"],
  approved:   ["processing", "failed"],
  processing: ["completed", "failed"],
  completed:  [],
  failed:     ["initiated"],   // possibilité de relancer
  reversed:   [],
};

function assertPayoutTransition(from: PayoutStatus, to: PayoutStatus): void {
  const allowed = PAYOUT_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AppError(
      `Transition payout invalide: ${from} → ${to}. Autorisées: [${allowed.join(", ")}]`,
      StatusCodes.UNPROCESSABLE_ENTITY
    );
  }
}

export const payoutService = {

  /**
   * Initie un payout pour un organisateur.
   * L'admin sélectionne les transactions à couvrir.
   */
  async initierPayout(data: {
    organizerId: string;
    transactionIds: string[];
    methodePaiement: string;
    referenceBancaire?: string;
    notes?: string;
    adminId: string;
    adminRole: string;
    adminIp?: string;
    adminUserAgent?: string;
  }) {
    if (!["admin", "super_admin"].includes(data.adminRole)) {
      throw new AppError("Seuls les admins peuvent initier un payout", StatusCodes.FORBIDDEN);
    }

    if (data.transactionIds.length === 0) {
      throw new AppError("Au moins une transaction doit être sélectionnée", StatusCodes.BAD_REQUEST);
    }

    // Vérifier que les transactions existent et appartiennent à l'organisateur
    const transactions = await prisma.transaction.findMany({
      where: {
        id: { in: data.transactionIds },
        organizerId: data.organizerId,
        status: "completed",
        payoutTransactions: { none: {} }, // non déjà couvertes
      },
    });

    if (transactions.length !== data.transactionIds.length) {
      throw new AppError(
        "Certaines transactions sont introuvables, n'appartiennent pas à cet organisateur, " +
        "ne sont pas en statut 'completed', ou ont déjà été incluses dans un payout",
        StatusCodes.BAD_REQUEST
      );
    }

    // Vérifier la cohérence des devises
    const devises = [...new Set(transactions.map((t) => t.devise))];
    if (devises.length > 1) {
      throw new AppError(
        `Impossible de mixer les devises dans un payout: ${devises.join(", ")}`,
        StatusCodes.BAD_REQUEST
      );
    }
    const devise = devises[0];

    // Calculer le montant total
    const montant = transactions.reduce((sum, t) => sum + t.netOrganisateur, 0);

    // Vérifier le solde disponible
    const wallet = await walletRepository.findByOrganizerId(data.organizerId);
    if (!wallet) {
      throw new AppError("Wallet organisateur introuvable", StatusCodes.NOT_FOUND);
    }

    if (wallet.soldeRetirable < montant) {
      throw new AppError(
        `Solde retirable insuffisant: ${formatMontant(wallet.soldeRetirable, devise)} disponible, ` +
        `${formatMontant(montant, devise)} requis`,
        StatusCodes.BAD_REQUEST
      );
    }

    // Créer le payout dans une transaction ACID
    const payout = await prisma.$transaction(async (tx) => {
      const p = await tx.payout.create({
        data: {
          organizerId: data.organizerId,
          walletId: wallet.id,
          montant,
          devise,
          methodePaiement: data.methodePaiement,
          referenceBancaire: data.referenceBancaire,
          notes: data.notes,
          transactions: {
            create: data.transactionIds.map((tid) => ({ transactionId: tid })),
          },
        },
        include: { organizer: { select: { id: true, name: true, email: true } } },
      });

      // Event sourcing — statut initial
      await tx.payoutStatusHistory.create({
        data: {
          payoutId: p.id,
          toStatus: "initiated",
          reason: "Payout initié par admin",
          actorId: data.adminId,
          actorRole: data.adminRole,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: data.adminId,
          userRole: data.adminRole,
          action: "PAYOUT_INITIATED",
          resource: "Payout",
          resourceId: p.id,
          ipAddress: data.adminIp,
          userAgent: data.adminUserAgent,
          dataAfter: {
            montant,
            devise,
            organizerId: data.organizerId,
            transactionCount: data.transactionIds.length,
          },
          checksum: genererChecksum({
            payoutId: p.id,
            adminId: data.adminId,
            montant,
            ts: new Date().toISOString(),
          }),
        },
      });

      return p;
    });

    return {
      payout,
      requiresDoubleValidation: montant >= PAYOUT_DOUBLE_VALIDATION_THRESHOLD,
      threshold: PAYOUT_DOUBLE_VALIDATION_THRESHOLD,
    };
  },

  /**
   * Approuve un payout (1ère ou 2ème validation selon seuil).
   */
  async approuverPayout(
    payoutId: string,
    admin: { id: string; role: string; ip?: string; userAgent?: string }
  ) {
    if (!["admin", "super_admin"].includes(admin.role)) {
      throw new AppError("Permissions insuffisantes", StatusCodes.FORBIDDEN);
    }

    const payout = await payoutRepository.findById(payoutId);
    if (!payout) throw new AppError("Payout introuvable", StatusCodes.NOT_FOUND);

    assertPayoutTransition(payout.statut, "approved");

    // Pour les gros payouts, s'assurer que l'approbateur ≠ initiateur
    if (
      payout.montant >= PAYOUT_DOUBLE_VALIDATION_THRESHOLD &&
      payout.approvedById === admin.id
    ) {
      throw new AppError(
        "Double validation requise: l'approbateur doit être différent de l'initiateur",
        StatusCodes.FORBIDDEN
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payout.update({
        where: { id: payoutId },
        data: {
          statut: "approved",
          approvedById: admin.id,
          approvedAt: new Date(),
        },
      });

      await tx.payoutStatusHistory.create({
        data: {
          payoutId,
          fromStatus: "initiated",
          toStatus: "approved",
          reason: "Approuvé par admin",
          actorId: admin.id,
          actorRole: admin.role,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: admin.id,
          userRole: admin.role,
          action: "PAYOUT_APPROVED",
          resource: "Payout",
          resourceId: payoutId,
          ipAddress: admin.ip,
          userAgent: admin.userAgent,
          dataBefore: { statut: "initiated" },
          dataAfter: { statut: "approved", approvedById: admin.id },
          checksum: genererChecksum({ payoutId, adminId: admin.id, action: "approve" }),
        },
      });

      return updated;
    });
  },

  /**
   * Exécute le payout : débit du wallet + ledger.
   * À appeler une fois le virement effectué en dehors du système.
   */
  async executerPayout(
    payoutId: string,
    admin: { id: string; role: string; ip?: string },
    referenceBancaire?: string,
    attachmentUrl?: string
  ) {
    if (!["admin", "super_admin"].includes(admin.role)) {
      throw new AppError("Permissions insuffisantes", StatusCodes.FORBIDDEN);
    }

    const payout = await payoutRepository.findById(payoutId);
    if (!payout) throw new AppError("Payout introuvable", StatusCodes.NOT_FOUND);

    assertPayoutTransition(payout.statut, "processing");

    if (payout.statut !== "approved") {
      throw new AppError("Le payout doit être approuvé avant exécution", StatusCodes.BAD_REQUEST);
    }

    return prisma.$transaction(async (tx) => {
      // Mettre à jour le statut
      await tx.payout.update({
        where: { id: payoutId },
        data: {
          statut: "processing",
          processedById: admin.id,
          processedAt: new Date(),
          ...(referenceBancaire && { referenceBancaire }),
          ...(attachmentUrl && { attachments: JSON.stringify([attachmentUrl]) }),
        },
      });

      await tx.payoutStatusHistory.create({
        data: {
          payoutId,
          fromStatus: "approved",
          toStatus: "processing",
          reason: "Exécution du payout",
          actorId: admin.id,
          actorRole: admin.role,
        },
      });

      // Débit du wallet
      const wallet = await tx.wallet.findUnique({ where: { id: payout.walletId } });
      if (!wallet) throw new AppError("Wallet introuvable", StatusCodes.NOT_FOUND);

      if (wallet.soldeRetirable < payout.montant) {
        throw new AppError(
          `Solde retirable insuffisant au moment de l'exécution: ` +
          `${formatMontant(wallet.soldeRetirable, payout.devise)} < ${formatMontant(payout.montant, payout.devise)}`,
          StatusCodes.BAD_REQUEST
        );
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          soldeDisponible: { decrement: payout.montant },
          soldeRetirable: { decrement: payout.montant },
          totalRetire: { increment: payout.montant },
          version: { increment: 1 },
        },
      });

      // Entrée ledger — débit payout
      const checksum = genererChecksum({
        walletId: wallet.id,
        payoutId,
        amount: payout.montant,
        ts: new Date().toISOString(),
      });

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          entryType: "debit",
          operationType: "payout",
          amount: payout.montant,
          balanceBefore: wallet.soldeDisponible,
          balanceAfter: wallet.soldeDisponible - payout.montant,
          description: `Payout ${payoutId} — ${payout.devise} ${formatMontant(payout.montant, payout.devise)}`,
          referenceId: payoutId,
          referenceType: "payout",
          actorId: admin.id,
          checksum,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: admin.id,
          userRole: admin.role,
          action: "PAYOUT_EXECUTED",
          resource: "Payout",
          resourceId: payoutId,
          ipAddress: admin.ip,
          dataBefore: { statut: "approved", soldeDisponible: wallet.soldeDisponible },
          dataAfter: {
            statut: "processing",
            soldeDisponible: wallet.soldeDisponible - payout.montant,
          },
          checksum: genererChecksum({ payoutId, adminId: admin.id, action: "execute" }),
        },
      });

      return { payout, nouveauSolde: wallet.soldeDisponible - payout.montant };
    });
  },

  /**
   * Confirme la réception du payout (virement reçu par l'organisateur).
   */
  async confirmerPayout(
    payoutId: string,
    admin: { id: string; role: string; ip?: string }
  ) {
    const payout = await payoutRepository.findById(payoutId);
    if (!payout) throw new AppError("Payout introuvable", StatusCodes.NOT_FOUND);

    assertPayoutTransition(payout.statut, "completed");

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payout.update({
        where: { id: payoutId },
        data: {
          statut: "completed",
          completedAt: new Date(),
        },
      });

      await tx.payoutStatusHistory.create({
        data: {
          payoutId,
          fromStatus: payout.statut,
          toStatus: "completed",
          reason: "Payout confirmé — fonds reçus par l'organisateur",
          actorId: admin.id,
          actorRole: admin.role,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: admin.id,
          userRole: admin.role,
          action: "PAYOUT_COMPLETED",
          resource: "Payout",
          resourceId: payoutId,
          dataAfter: { statut: "completed", completedAt: new Date().toISOString() },
          checksum: genererChecksum({ payoutId, adminId: admin.id, action: "complete" }),
        },
      });

      return updated;
    });
  },

  async annulerPayout(
    payoutId: string,
    raison: string,
    admin: { id: string; role: string; ip?: string }
  ) {
    const payout = await payoutRepository.findById(payoutId);
    if (!payout) throw new AppError("Payout introuvable", StatusCodes.NOT_FOUND);

    if (payout.statut === "completed") {
      throw new AppError(
        "Impossible d'annuler un payout complété. Utiliser 'reversed' pour un remboursement.",
        StatusCodes.BAD_REQUEST
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payout.update({
        where: { id: payoutId },
        data: { statut: "failed" },
      });

      await tx.payoutStatusHistory.create({
        data: {
          payoutId,
          fromStatus: payout.statut,
          toStatus: "failed",
          reason: raison,
          actorId: admin.id,
          actorRole: admin.role,
        },
      });

      // Si le wallet avait été débité (statut processing), rembourser
      if (payout.statut === "processing") {
        await tx.wallet.update({
          where: { id: payout.walletId },
          data: {
            soldeDisponible: { increment: payout.montant },
            soldeRetirable: { increment: payout.montant },
            totalRetire: { decrement: payout.montant },
            version: { increment: 1 },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: admin.id,
          userRole: admin.role,
          action: "PAYOUT_CANCELLED",
          resource: "Payout",
          resourceId: payoutId,
          dataBefore: { statut: payout.statut },
          dataAfter: { statut: "failed", raison },
          checksum: genererChecksum({ payoutId, adminId: admin.id, action: "cancel" }),
        },
      });

      return updated;
    });
  },

  async getPayoutById(id: string, userId: string, userRole: string) {
    const payout = await payoutRepository.findById(id);
    if (!payout) throw new AppError("Payout introuvable", StatusCodes.NOT_FOUND);

    const isAdmin = ["admin", "super_admin"].includes(userRole);
    const isOwner = payout.organizerId === userId;
    if (!isAdmin && !isOwner) {
      throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
    }

    return payout;
  },

  async listerPayouts(
    filters: Parameters<typeof payoutRepository.findMany>[0],
    userId: string,
    userRole: string
  ) {
    const isAdmin = ["admin", "super_admin"].includes(userRole);
    if (!isAdmin) {
      filters.organizerId = userId;
    }
    return payoutRepository.findMany(filters);
  },
};
