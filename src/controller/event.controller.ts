// @ts-nocheck
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { eventService } from "../services/event.service.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import { prisma } from "../config/database.js";

export const createEvent = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const event = await eventService.createEvent({ ...req.body, organizerId });
  res.status(StatusCodes.CREATED).json(
    jsonResponse({ status: "success", message: "Événement créé", data: event })
  );
});

export const getMyEvents = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const events = await eventService.getOrganizerEvents(organizerId);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Événements récupérés", data: events })
  );
});

export const getAllEvents = controllerWrapper(async (req: Request, res: Response) => {
  const countryCode = req.query.country ? String(req.query.country).toUpperCase() : undefined;
  const featuredOnly = req.query.featured === "true";

  // Récupérer les intérêts de l'utilisateur connecté (auth optionnelle)
  let interests: string[] | undefined;
  if (req.user?.userId) {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { interests: true } });
    if (user?.interests) {
      try {
        const parsed = JSON.parse(user.interests);
        if (Array.isArray(parsed) && parsed.length > 0) {
          interests = parsed;
        }
      } catch { /* malformed JSON, ignore */ }
    }
  }

  const events = await eventService.getAllEvents(countryCode, featuredOnly, interests);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Événements récupérés", data: events })
  );
});

export const getEventById = controllerWrapper(async (req: Request, res: Response) => {
  const event = await eventService.getEventById(req.params.id);
  if (!event) {
    return res.status(StatusCodes.NOT_FOUND).json(
      jsonResponse({ status: "error", message: "Événement introuvable" })
    );
  }
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Événement récupéré", data: event })
  );
});

export const deleteEvent = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const role = req.user!.role;
  await eventService.deleteEvent(req.params.id, organizerId, role);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Événement supprimé" })
  );
});

export const toggleSalesBlocked = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const role = req.user!.role;
  const result = await eventService.toggleSalesBlocked(req.params.id, organizerId, role);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: result.salesBlocked ? "Ventes suspendues" : "Ventes réactivées", data: result })
  );
});

export const toggleFavorite = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const result = await eventService.toggleFavorite(userId, req.params.id);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: result.isFavorited ? "Ajouté aux favoris" : "Retiré des favoris", data: result })
  );
});

export const checkFavorite = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const isFavorited = await eventService.isFavorited(userId, req.params.id);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "OK", data: { isFavorited } })
  );
});

export const getMyFavorites = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const events = await eventService.getMyFavorites(userId);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Favoris récupérés", data: events })
  );
});

export const updateEvent = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const role = req.user!.role;
  const event = await eventService.updateEvent(req.params.id, organizerId, req.body, role);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Événement mis à jour", data: event })
  );
});
