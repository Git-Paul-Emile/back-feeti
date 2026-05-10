import { prisma } from "../config/database.js";
import type { TransactionStatus, Prisma } from "../generated/prisma/client.js";

export interface CreateTransactionData {
  idempotencyKey: string;
  eventId: string;
  organizerId: string;
  buyerId: string;
  ticketId: string;
  montantTTC: number;
  montantHT: number;
  tva: number;
  commission: number;
  netOrganisateur: number;
  devise: string;
  tauxTVA: number;
  tauxCommission: number;
  paymentMethod?: string;
  paymentProviderTransactionId?: string;
  metadata?: Record<string, unknown>;
  checksum: string;
}

export interface TransactionFilters {
  organizerId?: string;
  buyerId?: string;
  eventId?: string;
  status?: TransactionStatus;
  dateFrom?: Date;
  dateTo?: Date;
  devise?: string;
  page?: number;
  limit?: number;
}

export const transactionRepository = {
  async create(data: CreateTransactionData) {
    return prisma.transaction.create({
      data: {
        idempotencyKey: data.idempotencyKey,
        eventId: data.eventId,
        organizerId: data.organizerId,
        buyerId: data.buyerId,
        ticketId: data.ticketId,
        montantTTC: data.montantTTC,
        montantHT: data.montantHT,
        tva: data.tva,
        commission: data.commission,
        netOrganisateur: data.netOrganisateur,
        devise: data.devise,
        tauxTVA: data.tauxTVA,
        tauxCommission: data.tauxCommission,
        paymentMethod: data.paymentMethod,
        paymentProviderTransactionId: data.paymentProviderTransactionId,
        metadata: data.metadata as Prisma.InputJsonValue,
        checksum: data.checksum,
      },
      include: {
        event: { select: { id: true, title: true } },
        organizer: { select: { id: true, name: true, email: true } },
        buyer: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async findById(id: string) {
    return prisma.transaction.findUnique({
      where: { id },
      include: {
        event: { select: { id: true, title: true } },
        organizer: { select: { id: true, name: true, email: true } },
        buyer: { select: { id: true, name: true, email: true } },
        statusHistory: { orderBy: { createdAt: "asc" } },
        payoutTransactions: {
          include: { payout: { select: { id: true, statut: true, completedAt: true } } },
        },
      },
    });
  },

  async findByIdempotencyKey(key: string) {
    return prisma.transaction.findUnique({ where: { idempotencyKey: key } });
  },

  async findByTicketId(ticketId: string) {
    return prisma.transaction.findUnique({ where: { ticketId } });
  },

  async updateStatus(
    id: string,
    newStatus: TransactionStatus,
    extra?: {
      completedAt?: Date;
      refundAmount?: number;
      refundReason?: string;
      paymentProviderTransactionId?: string;
    }
  ) {
    return prisma.transaction.update({
      where: { id },
      data: {
        status: newStatus,
        ...(extra?.completedAt && { completedAt: extra.completedAt }),
        ...(extra?.refundAmount !== undefined && { refundAmount: extra.refundAmount }),
        ...(extra?.refundReason && { refundReason: extra.refundReason }),
        ...(extra?.paymentProviderTransactionId && {
          paymentProviderTransactionId: extra.paymentProviderTransactionId,
        }),
      },
    });
  },

  async addStatusHistory(data: {
    transactionId: string;
    fromStatus?: TransactionStatus;
    toStatus: TransactionStatus;
    reason?: string;
    actorId?: string;
    actorRole?: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.transactionStatusHistory.create({
      data: {
        transactionId: data.transactionId,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        reason: data.reason,
        actorId: data.actorId,
        actorRole: data.actorRole,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  },

  async findMany(filters: TransactionFilters) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      ...(filters.organizerId && { organizerId: filters.organizerId }),
      ...(filters.buyerId && { buyerId: filters.buyerId }),
      ...(filters.eventId && { eventId: filters.eventId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.devise && { devise: filters.devise }),
      ...((filters.dateFrom || filters.dateTo) && {
        createdAt: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          event: { select: { id: true, title: true } },
          organizer: { select: { id: true, name: true } },
          buyer: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  },

  // Agrégations pour reporting
  async aggregateByOrganizer(organizerId: string, dateFrom?: Date, dateTo?: Date) {
    return prisma.transaction.aggregate({
      where: {
        organizerId,
        status: { in: ["completed", "paid"] },
        ...(dateFrom || dateTo
          ? { createdAt: { gte: dateFrom, lte: dateTo } }
          : {}),
      },
      _sum: {
        montantTTC: true,
        montantHT: true,
        tva: true,
        commission: true,
        netOrganisateur: true,
      },
      _count: { id: true },
    });
  },

  async aggregateByEvent(eventId: string) {
    return prisma.transaction.groupBy({
      by: ["status"],
      where: { eventId },
      _sum: { montantTTC: true, netOrganisateur: true, tva: true },
      _count: { id: true },
    });
  },

  async findCompletedNotInPayout(organizerId: string) {
    return prisma.transaction.findMany({
      where: {
        organizerId,
        status: "completed",
        payoutTransactions: { none: {} },
      },
      select: { id: true, netOrganisateur: true, devise: true, completedAt: true },
    });
  },

  async getTVAReport(dateFrom: Date, dateTo: Date, organizerId?: string) {
    return prisma.transaction.aggregate({
      where: {
        status: { in: ["completed", "paid"] },
        createdAt: { gte: dateFrom, lte: dateTo },
        ...(organizerId && { organizerId }),
      },
      _sum: { tva: true, montantHT: true, montantTTC: true },
      _count: { id: true },
    });
  },
};
