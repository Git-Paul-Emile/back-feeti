/**
 * ═══════════════════════════════════════════════════════════════════════
 *  SERVICE WALLET ORGANISATEUR — Grand livre comptable en partie double
 * ═══════════════════════════════════════════════════════════════════════
 */

import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/database.js";
import { genererChecksum, formatMontant } from "../utils/financial.js";
import { walletRepository } from "../repositories/wallet.repository.js";

export const walletService = {

  async getOrCreateWallet(organizerId: string, devise: string = "XOF") {
    return walletRepository.upsertForOrganizer(organizerId, devise);
  },

  async getWalletByOrganizerId(organizerId: string) {
    const wallet = await walletRepository.findByOrganizerId(organizerId);
    if (!wallet) {
      throw new AppError("Wallet introuvable pour cet organisateur", StatusCodes.NOT_FOUND);
    }
    return wallet;
  },

  async getWalletSummary(organizerId: string) {
    const wallet = await walletRepository.getWalletSummaryByOrganizer(organizerId);
    if (!wallet) {
      // Créer le wallet à la première demande
      return walletRepository.upsertForOrganizer(organizerId);
    }

    return {
      ...wallet,
      formatted: {
        soldeTotal: formatMontant(wallet.soldeTotal, wallet.devise),
        soldeDisponible: formatMontant(wallet.soldeDisponible, wallet.devise),
        soldeEnAttente: formatMontant(wallet.soldeEnAttente, wallet.devise),
        soldeRetirable: formatMontant(wallet.soldeRetirable, wallet.devise),
        totalRetire: formatMontant(wallet.totalRetire, wallet.devise),
        totalEnLitige: formatMontant(wallet.totalEnLitige, wallet.devise),
      },
    };
  },

  async getLedger(
    organizerId: string,
    options?: { page?: number; limit?: number; dateFrom?: Date; dateTo?: Date }
  ) {
    const wallet = await walletRepository.findByOrganizerId(organizerId);
    if (!wallet) {
      throw new AppError("Wallet introuvable", StatusCodes.NOT_FOUND);
    }
    return walletRepository.getLedgerEntries(wallet.id, options);
  },

  /**
   * Vérifie la cohérence du solde par rejeu complet du ledger.
   * Opération d'audit — à utiliser pour vérification externe.
   */
  async verifierIntegrite(organizerId: string) {
    const wallet = await walletRepository.findByOrganizerId(organizerId);
    if (!wallet) {
      throw new AppError("Wallet introuvable", StatusCodes.NOT_FOUND);
    }

    const balanceCalculee = await walletRepository.replayLedger(wallet.id);

    // Le solde calculé par rejeu doit correspondre au solde total (gains nets)
    const ecart = wallet.soldeDisponible - balanceCalculee;
    const coherent = ecart === 0;

    return {
      coherent,
      soldeEnregistre: wallet.soldeDisponible,
      soldeCalcule: balanceCalculee,
      ecart,
      message: coherent
        ? "✅ Intégrité du wallet vérifiée — les soldes correspondent"
        : `⚠️ Anomalie détectée — écart de ${ecart} centimes (${formatMontant(Math.abs(ecart), wallet.devise)})`,
    };
  },

  /**
   * Ajustement manuel admin avec entrée de ledger obligatoire.
   * Nécessite un motif et une traçabilité complète.
   */
  async ajustementAdmin(
    organizerId: string,
    montantCentimes: number,
    type: "credit" | "debit",
    motif: string,
    adminId: string,
    adminRole: string
  ) {
    if (!["admin", "super_admin"].includes(adminRole)) {
      throw new AppError("Seuls les admins peuvent effectuer des ajustements", StatusCodes.FORBIDDEN);
    }

    if (montantCentimes <= 0) {
      throw new AppError("Le montant d'ajustement doit être positif", StatusCodes.BAD_REQUEST);
    }

    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { organizerId } });
      if (!wallet) throw new AppError("Wallet introuvable", StatusCodes.NOT_FOUND);

      const balanceBefore = wallet.soldeDisponible;
      const balanceAfter = type === "credit"
        ? balanceBefore + montantCentimes
        : balanceBefore - montantCentimes;

      if (balanceAfter < 0) {
        throw new AppError(
          `Ajustement débit impossible: solde résultant négatif (${balanceAfter} centimes)`,
          StatusCodes.BAD_REQUEST
        );
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          soldeDisponible: type === "credit"
            ? { increment: montantCentimes }
            : { decrement: montantCentimes },
          soldeTotal: type === "credit"
            ? { increment: montantCentimes }
            : { decrement: montantCentimes },
          soldeRetirable: type === "credit"
            ? { increment: montantCentimes }
            : { decrement: montantCentimes },
          version: { increment: 1 },
        },
      });

      const checksum = genererChecksum({
        walletId: wallet.id,
        entryType: type,
        amount: montantCentimes,
        adminId,
        motif,
        ts: new Date().toISOString(),
      });

      const ledgerEntry = await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          entryType: type,
          operationType: "adjustment",
          amount: montantCentimes,
          balanceBefore,
          balanceAfter,
          description: `Ajustement admin: ${motif}`,
          actorId: adminId,
          checksum,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          userRole: adminRole,
          action: "WALLET_ADJUSTMENT",
          resource: "Wallet",
          resourceId: wallet.id,
          dataBefore: { soldeDisponible: balanceBefore },
          dataAfter: { soldeDisponible: balanceAfter, montant: montantCentimes, type: type },
          metadata: { motif },
          checksum: genererChecksum({
            adminId,
            walletId: wallet.id,
            type,
            montant: montantCentimes,
            motif,
          }),
        },
      });

      return { wallet: { ...wallet, soldeDisponible: balanceAfter }, ledgerEntry };
    });
  },
};
