import { prisma } from "../config/database.js";

export const eventControllerRepository = {
  /** Assigner un contrôleur à un événement */
  async assign(eventId: string, controllerId: string) {
    return prisma.eventController.create({
      data: { eventId, controllerId },
      include: { controller: { select: { id: true, name: true, email: true, phone: true } } },
    });
  },

  /** Retirer un contrôleur d'un événement */
  async remove(eventId: string, controllerId: string) {
    return prisma.eventController.deleteMany({ where: { eventId, controllerId } });
  },

  /** Lister les contrôleurs d'un événement */
  async findByEvent(eventId: string) {
    return prisma.eventController.findMany({
      where: { eventId },
      include: { controller: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { assignedAt: "asc" },
    });
  },

  /** Lister les événements d'un contrôleur */
  async findByController(controllerId: string) {
    return prisma.eventController.findMany({
      where: { controllerId },
      include: { event: true },
      orderBy: { assignedAt: "desc" },
    });
  },

  /** Vérifier si un contrôleur est affecté à un événement */
  async isAssigned(eventId: string, controllerId: string) {
    const record = await prisma.eventController.findUnique({
      where: { eventId_controllerId: { eventId, controllerId } },
    });
    return record !== null;
  },
};
