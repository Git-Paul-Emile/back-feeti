import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/AppError.js";
import { ticketRepository } from "../repositories/ticket.repository.js";
import { eventRepository } from "../repositories/event.repository.js";
import { eventService } from "./event.service.js";
import { prisma } from "../config/database.js";
import { randomUUID } from "crypto";
import { createHmac } from "crypto";

const TICKET_SECRET = process.env.TICKET_SECRET || "feeti-ticket-secret-key";

function generateQRData(ticketId: string, orderId: string, eventId: string): string {
  const timestamp = Date.now();
  const payload = JSON.stringify({ ticketId, orderId, eventId, timestamp });
  const signature = createHmac("sha256", TICKET_SECRET).update(payload).digest("hex");
  return JSON.stringify({ ticketId, orderId, eventId, timestamp, signature });
}

export const ticketService = {
  async purchaseTickets(data: {
    eventId: string;
    userId: string;
    holderName: string;
    holderEmail: string;
    items: { category: string; quantity: number; price: number }[];
    delivery?: {
      method: "email" | "physical";
      zoneId?: string;
      recipientName?: string;
      recipientPhone?: string;
      additionalInfo?: string;
    };
  }) {
    const event = await eventRepository.findById(data.eventId);
    if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
    if (event.status !== "published") throw new AppError("Cet événement n'est pas disponible à la vente", StatusCodes.BAD_REQUEST);

    // Vérification de la date : l'événement ne doit pas être passé
    const eventDate = new Date(`${event.date}T${event.time || "00:00"}`);
    if (eventDate < new Date()) {
      throw new AppError("Cet événement est terminé, la vente de billets est clôturée", StatusCodes.BAD_REQUEST);
    }

    // Vérification du blocage par l'organisateur
    if ((event as any).salesBlocked) {
      throw new AppError("La vente de billets est temporairement suspendue par l'organisateur", StatusCodes.BAD_REQUEST);
    }

    const totalQty = data.items.reduce((s, i) => s + i.quantity, 0);
    if (event.attendees + totalQty > event.maxAttendees) {
      throw new AppError("Nombre maximum de participants atteint", StatusCodes.BAD_REQUEST);
    }

    // Résoudre la livraison physique
    let deliveryFee = 0;

    if (data.delivery?.method === "physical") {
      if (!data.delivery.zoneId) throw new AppError("Zone de livraison obligatoire", StatusCodes.BAD_REQUEST);
      if (!data.delivery.recipientName || !data.delivery.recipientPhone) {
        throw new AppError("Nom et téléphone du destinataire obligatoires", StatusCodes.BAD_REQUEST);
      }
      const zone = await prisma.deliveryZone.findUnique({ where: { id: data.delivery.zoneId } });
      if (!zone) throw new AppError("Zone de livraison introuvable", StatusCodes.NOT_FOUND);
      deliveryFee = zone.fee;
    }

    const orderId = randomUUID();
    const tickets = [];

    for (const item of data.items) {
      for (let i = 0; i < item.quantity; i++) {
        const ticketId = randomUUID();
        const qrData = generateQRData(ticketId, orderId, data.eventId);
        const ticket = await ticketRepository.create({
          eventId: data.eventId,
          userId: data.userId,
          category: item.category,
          price: item.price,
          currency: event.currency,
          holderName: data.holderName,
          holderEmail: data.holderEmail,
          qrData,
          orderId,
          deliveryMethod: data.delivery?.method === "physical" ? "physical" : "email",
          deliveryStatus: data.delivery?.method === "physical" ? "pending" : undefined,
        });

        // Créer l'adresse de livraison pour le premier billet seulement
        if (data.delivery?.method === "physical" && i === 0 && item === data.items[0]) {
          await prisma.deliveryAddress.create({
            data: {
              ticketId: ticket.id,
              recipientName: data.delivery.recipientName!,
              recipientPhone: data.delivery.recipientPhone!,
              zoneId: data.delivery.zoneId!,
              additionalInfo: data.delivery.additionalInfo,
              deliveryFee,
            },
          });
        }

        tickets.push(ticket);
      }
    }

    // Update attendees count
    await eventRepository.update(data.eventId, { attendees: event.attendees + totalQty });

    return { orderId, tickets, deliveryFee };
  },

  async getMyTickets(userId: string) {
    return ticketRepository.findByUser(userId);
  },

  async getTicketById(id: string, userId: string, role?: string) {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new AppError("Billet introuvable", StatusCodes.NOT_FOUND);
    const isAdmin = role === "admin" || role === "super_admin";
    const isOrganizer = role === "organizer" && ticket.event.organizerId === userId;
    // Les contrôleurs peuvent voir les billets via leurs endpoints dédiés
    if (!isAdmin && !isOrganizer && ticket.userId !== userId) {
      throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
    }
    return ticket;
  },

  async verifyTicket(qrData: string, organizerId: string, role?: string) {
    const ticket = await ticketRepository.findByQrData(qrData);
    if (!ticket) throw new AppError("Billet invalide ou introuvable", StatusCodes.NOT_FOUND);

    const isAdmin = role === "admin" || role === "super_admin";
    const isEventOrganizer = ticket.event.organizerId === organizerId;
    if (!isAdmin && !isEventOrganizer) {
      throw new AppError("Accès refusé : vous n'êtes pas l'organisateur de cet événement", StatusCodes.FORBIDDEN);
    }

    if (ticket.status === "used") throw new AppError("Ce billet a déjà été utilisé", StatusCodes.BAD_REQUEST);
    if (ticket.status === "expired") throw new AppError("Ce billet est expiré", StatusCodes.BAD_REQUEST);
    if (ticket.status !== "valid") throw new AppError("Ce billet n'est pas valide", StatusCodes.BAD_REQUEST);

    const updated = await ticketRepository.updateStatus(ticket.id, "used", new Date());
    return { ticket: updated, message: "Billet validé avec succès" };
  },

  async getEventTickets(eventId: string, organizerId: string, role?: string) {
    const event = await eventService.getEventById(eventId);
    if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
    const isAdmin = role === "admin" || role === "super_admin";
    if (!isAdmin && event.organizerId !== organizerId) {
      throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
    }
    return ticketRepository.findByEvent(eventId);
  },
};
