import { prisma } from "../config/database.js";
import type { LedgerEntryType, LedgerOperationType, Prisma } from "../generated/prisma/client.js";

export interface WalletUpdateData {
  soldeTotal?: number;
  soldeDisponible?: number;
  soldeEnAttente?: number;
  soldeRetirable?: number;
  totalRetire?: number;
  totalEnLitige?: number;
  checksum?: string;
  version?: number;
}

export interface LedgerEntryData {
  walletId: string;
  entryType: LedgerEntryType;
  operationType: LedgerOperationType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  referenceType?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
  checksum: string;
}

export const walletRepository = {
  async findByOrganizerId(organizerId: string) {
    return prisma.wallet.findUnique({
      where: { organizerId },
    });
  },

  async findByIdWithLock(organizerId: string) {
    // Prisma ne supporte pas SELECT FOR UPDATE nativement
    // On utilise une transaction raw pour le verrouillage pessimiste
    return prisma.$queryRaw<Array<{
      id: string;
      organizerId: string;
      soldeDisponible: number;
      soldeEnAttente: number;
      soldeTotal: number;
      soldeRetirable: number;
      totalRetire: number;
      totalEnLitige: number;
      devise: string;
      version: number;
    }>>`
      SELECT id, "organizerId", "soldeDisponible", "soldeEnAttente",
             "soldeTotal", "soldeRetirable", "totalRetire", "totalEnLitige",
             devise, version
      FROM "Wallet"
      WHERE "organizerId" = ${organizerId}
      FOR UPDATE
    `;
  },

  async createForOrganizer(organizerId: string, devise: string = "XOF") {
    return prisma.wallet.create({
      data: {
        organizerId,
        devise,
        checksum: "",
      },
    });
  },

  async upsertForOrganizer(organizerId: string, devise: string = "XOF") {
    return prisma.wallet.upsert({
      where: { organizerId },
      create: { organizerId, devise, checksum: "" },
      update: {},
    });
  },

  // Mise à jour avec verrouillage optimiste (version check)
  async updateWithOptimisticLock(
    walletId: string,
    expectedVersion: number,
    data: WalletUpdateData
  ): Promise<boolean> {
    const result = await prisma.wallet.updateMany({
      where: { id: walletId, version: expectedVersion },
      data: {
        ...data,
        version: expectedVersion + 1,
      },
    });
    return result.count > 0;
  },

  async update(walletId: string, data: WalletUpdateData) {
    return prisma.wallet.update({
      where: { id: walletId },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
  },

  async addLedgerEntry(entry: LedgerEntryData) {
    return prisma.walletLedger.create({
      data: {
        walletId: entry.walletId,
        entryType: entry.entryType,
        operationType: entry.operationType,
        amount: entry.amount,
        balanceBefore: entry.balanceBefore,
        balanceAfter: entry.balanceAfter,
        description: entry.description,
        referenceId: entry.referenceId,
        referenceType: entry.referenceType,
        actorId: entry.actorId,
        metadata: entry.metadata as Prisma.InputJsonValue,
        checksum: entry.checksum,
      },
    });
  },

  async getLedgerEntries(
    walletId: string,
    options?: { page?: number; limit?: number; dateFrom?: Date; dateTo?: Date }
  ) {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.WalletLedgerWhereInput = {
      walletId,
      ...(options?.dateFrom || options?.dateTo
        ? {
            createdAt: {
              ...(options.dateFrom && { gte: options.dateFrom }),
              ...(options.dateTo && { lte: options.dateTo }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.walletLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.walletLedger.count({ where }),
    ]);

    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  },

  // Rejouer le ledger pour vérifier la cohérence du solde
  async replayLedger(walletId: string): Promise<number> {
    const entries = await prisma.walletLedger.findMany({
      where: { walletId },
      orderBy: { createdAt: "asc" },
    });

    let balance = 0;
    for (const entry of entries) {
      if (entry.entryType === "credit") {
        balance += entry.amount;
      } else {
        balance -= entry.amount;
      }
    }
    return balance;
  },

  async getWalletSummaryByOrganizer(organizerId: string) {
    return prisma.wallet.findUnique({
      where: { organizerId },
      select: {
        id: true,
        soldeTotal: true,
        soldeDisponible: true,
        soldeEnAttente: true,
        soldeRetirable: true,
        totalRetire: true,
        totalEnLitige: true,
        devise: true,
        updatedAt: true,
      },
    });
  },
};
