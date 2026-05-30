import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ticketService } from "../services/ticket.service.js";
import { ticketRepository } from "../repositories/ticket.repository.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import PDFDocument from "pdfkit";
import { buildTicketJpegBuffer } from "../services/ticket-canvas.service.js";

export const purchaseTickets = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const result = await ticketService.purchaseTickets({ ...req.body, userId });
  res.status(StatusCodes.CREATED).json(
    jsonResponse({ status: "success", message: "Achat effectué avec succès", data: result })
  );
});

export const getMyTickets = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const tickets = await ticketService.getMyTickets(userId);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Billets récupérés", data: tickets })
  );
});

export const getTicketById = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const ticket = await ticketService.getTicketById(String(req.params.id), userId, role);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Billet récupéré", data: ticket })
  );
});

export const verifyTicket = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const role = req.user!.role;
  const { qrData } = req.body;
  if (!qrData) {
    res.status(StatusCodes.BAD_REQUEST).json(jsonResponse({ status: "error", message: "qrData requis" }));
    return;
  }
  const result = await ticketService.verifyTicket(qrData, organizerId, role);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: result.message, data: result.ticket })
  );
});

export const getEventTickets = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const role = req.user!.role;
  const tickets = await ticketService.getEventTickets(String(req.params.eventId), organizerId, role);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Billets de l'événement récupérés", data: tickets })
  );
});

export async function downloadTicketPDF(req: Request, res: Response): Promise<void> {
  try {
    const ticket = await ticketRepository.findById(String(req.params.id));
    if (!ticket) {
      res.status(StatusCodes.NOT_FOUND).send("Billet introuvable");
      return;
    }

    const ev = (ticket as any).event;
    const filename = `billet-${(ev?.title ?? "ticket").replace(/\s+/g, "-")}-${ticket.id.slice(-8)}.pdf`;

    const jpegBuffer = await buildTicketJpegBuffer({
      id: ticket.id,
      eventTitle: ev?.title ?? "Événement",
      eventDate: ev?.date ?? "",
      eventTime: ev?.time ?? "",
      eventLocation: ev?.location ?? "",
      eventImage: ev?.image ?? undefined,
      category: ticket.category,
      price: ticket.price,
      currency: ticket.currency,
      holderName: ticket.holderName,
      holderEmail: ticket.holderEmail,
      qrData: ticket.qrData,
    });

    // Envelopper le JPEG dans un PDF A4 paysage (identique à jsPDF côté front)
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    const pageW = doc.page.width;   // ~841 pt
    const pageH = doc.page.height;  // ~595 pt
    const margin = 10;
    // Ratio canvas → page (1659×704)
    const ratio = Math.min((pageW - margin * 2) / 1659, (pageH - margin * 2) / 704);
    const imgW = 1659 * ratio;
    const imgH = 704 * ratio;
    const x = (pageW - imgW) / 2;
    const y = (pageH - imgH) / 2;

    doc.image(jpegBuffer, x, y, { width: imgW, height: imgH });
    doc.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Erreur génération PDF");
    }
  }
}

export const requestRefund = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const ticketId = String(req.params.id);
  const { reason } = req.body as { reason?: string };
  if (!reason?.trim()) {
    res.status(StatusCodes.BAD_REQUEST).json(jsonResponse({ status: "error", message: "La raison du remboursement est obligatoire" }));
    return;
  }
  const ticket = await ticketService.requestRefund(ticketId, userId, reason.trim());
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Demande de remboursement envoyée. Délai de traitement : 5 à 7 jours ouvrables.", data: ticket })
  );
});
