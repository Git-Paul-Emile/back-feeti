import { prisma } from "../config/database.js";

export const ticketRepository = {
  async create(data: {
    eventId: string;
    userId: string;
    category: string;
    price: number;
    currency: string;
    holderName: string;
    holderEmail: string;
    qrData: string;
    orderId: string;
    deliveryMethod?: "email" | "physical";
    deliveryStatus?: "pending" | "processing" | "shipped" | "delivered" | "failed";
  }) {
    return prisma.ticket.create({ data });
  },

  async findByUser(userId: string) {
    return prisma.ticket.findMany({
      where: { userId },
      include: { event: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      include: { event: true, user: true },
    });
  },

  async findByQrData(qrData: string) {
    return prisma.ticket.findFirst({
      where: { qrData },
      include: { event: true, user: true },
    });
  },

  async findByEvent(eventId: string) {
    return prisma.ticket.findMany({
      where: { eventId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async countByEvent(eventId: string) {
    return prisma.ticket.count({ where: { eventId } });
  },

  async updateStatus(id: string, status: string, usedAt?: Date) {
    return prisma.ticket.update({
      where: { id },
      data: { status, ...(usedAt && { usedAt }) },
    });
  },
};
