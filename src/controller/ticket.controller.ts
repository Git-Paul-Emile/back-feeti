import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ticketService } from "../services/ticket.service.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";

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
