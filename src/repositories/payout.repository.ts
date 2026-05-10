import { prisma } from "../config/database.js";
import type { PayoutStatus, Prisma } from "../generated/prisma/client.js";

export interface CreatePayoutData {
  organizerId: string;
  walletId: string;
  montant: number;
  devise: string;
  methodePaiement: string;
  referenceBancaire?: string;
  notes?: string;
  transactionIds: string[];
}

export interface PayoutFilters {
  organizerId?: string;
  statut?: PayoutStatus;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export const payoutRepository = {
  async create(data: CreatePayoutData) {
    return prisma.payout.create({
      data: {
        organizerId: data.organizerId,
        walletId: data.walletId,
        montant: data.montant,
        devise: data.devise,
        methodePaiement: data.methodePaiement,
        referenceBancaire: data.referenceBancaire,
        notes: data.notes,
        transactions: {
          create: data.transactionIds.map((tid) => ({
            transactionId: tid,
          })),
        },
      },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        transactions: { include: { transaction: { select: { id: true, montantTTC: true } } } },
      },
    });
  },

  async findById(id: string) {
    return prisma.payout.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
        processedBy: { select: { id: true, name: true } },
        transactions: {
          include: {
            transaction: {
              select: {
                id: true,
                montantTTC: true,
                netOrganisateur: true,
                devise: true,
                completedAt: true,
              },
            },
          },
        },
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });
  },

  async findMany(filters: PayoutFilters) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PayoutWhereInput = {
      ...(filters.organizerId && { organizerId: filters.organizerId }),
      ...(filters.statut && { statut: filters.statut }),
      ...((filters.dateFrom || filters.dateTo) && {
        initiatedAt: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { initiatedAt: "desc" },
        include: {
          organizer: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true } },
          _count: { select: { transactions: true } },
        },
      }),
      prisma.payout.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  },

  async updateStatus(
    id: string,
    newStatus: PayoutStatus,
    extra?: {
      approvedById?: string;
      approvedAt?: Date;
      processedById?: string;
      processedAt?: Date;
      completedAt?: Date;
      referenceBancaire?: string;
      attachments?: string;
    }
  ) {
    return prisma.payout.update({
      where: { id },
      data: {
        statut: newStatus,
        ...(extra?.approvedById && { approvedById: extra.approvedById }),
        ...(extra?.approvedAt && { approvedAt: extra.approvedAt }),
        ...(extra?.processedById && { processedById: extra.processedById }),
        ...(extra?.processedAt && { processedAt: extra.processedAt }),
        ...(extra?.completedAt && { completedAt: extra.completedAt }),
        ...(extra?.referenceBancaire && { referenceBancaire: extra.referenceBancaire }),
        ...(extra?.attachments && { attachments: extra.attachments }),
      },
    });
  },

  async addStatusHistory(data: {
    payoutId: string;
    fromStatus?: PayoutStatus;
    toStatus: PayoutStatus;
    reason?: string;
    actorId?: string;
    actorRole?: string;
  }) {
    return prisma.payoutStatusHistory.create({ data });
  },

  async aggregateForOrganizer(organizerId: string) {
    return prisma.payout.aggregate({
      where: { organizerId, statut: "completed" },
      _sum: { montant: true },
      _count: { id: true },
    });
  },
};
