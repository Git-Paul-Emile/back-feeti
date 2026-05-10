import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/database.js";
import { AppError } from "../utils/AppError.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";

// POST /api/events/:id/featured-request
// Organisateur soumet une demande de mise en avant
export const submitFeaturedRequest = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = String(req.params.id);
  const organizerId = req.user!.userId;
  const { message } = req.body as { message?: string };

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
  if (event.organizerId !== organizerId) throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
  if (event.status !== "published") throw new AppError("L'événement doit être publié pour être mis en avant", StatusCodes.BAD_REQUEST);

  // Vérifier si une demande en attente existe déjà
  const existing = await prisma.featuredRequest.findFirst({
    where: { eventId, organizerId, status: "pending" },
  });
  if (existing) throw new AppError("Une demande est déjà en attente pour cet événement", StatusCodes.CONFLICT);

  const request = await prisma.featuredRequest.create({
    data: { eventId, organizerId, message },
    include: {
      event: { select: { title: true, image: true, date: true } },
    },
  });

  res.status(StatusCodes.CREATED).json(
    jsonResponse({ status: "success", message: "Demande de mise en avant envoyée", data: request })
  );
});

// GET /api/events/my-featured-requests
// Organisateur consulte l'état de ses demandes
export const getMyFeaturedRequests = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;

  const requests = await prisma.featuredRequest.findMany({
    where: { organizerId },
    include: {
      event: { select: { id: true, title: true, image: true, date: true, isFeatured: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Demandes récupérées", data: requests })
  );
});

// GET /api/admin/featured-requests
// Admin liste toutes les demandes
export const getAllFeaturedRequests = controllerWrapper(async (_req: Request, res: Response) => {
  const requests = await prisma.featuredRequest.findMany({
    include: {
      event: {
        select: {
          id: true, title: true, description: true, image: true,
          date: true, time: true, location: true, category: true,
          price: true, currency: true, attendees: true, maxAttendees: true,
          isLive: true, isFeatured: true, status: true,
        },
      },
      organizer: { select: { id: true, name: true, email: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Demandes récupérées", data: requests })
  );
});

// PATCH /api/admin/featured-requests/:id/approve
// Admin approuve — met isFeatured = true sur l'événement
export const approveFeaturedRequest = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { adminNote } = req.body as { adminNote?: string };

  const request = await prisma.featuredRequest.findUnique({
    where: { id },
    include: { event: true },
  });
  if (!request) throw new AppError("Demande introuvable", StatusCodes.NOT_FOUND);
  if (request.status !== "pending") throw new AppError("Cette demande a déjà été traitée", StatusCodes.CONFLICT);

  await prisma.$transaction([
    prisma.featuredRequest.update({
      where: { id },
      data: { status: "approved", adminNote },
    }),
    prisma.event.update({
      where: { id: request.eventId },
      data: { isFeatured: true },
    }),
  ]);

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Demande approuvée — événement mis en avant" })
  );
});

// PATCH /api/admin/featured-requests/:id/reject
// Admin rejette la demande
export const rejectFeaturedRequest = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { adminNote } = req.body as { adminNote?: string };

  const request = await prisma.featuredRequest.findUnique({ where: { id } });
  if (!request) throw new AppError("Demande introuvable", StatusCodes.NOT_FOUND);
  if (request.status !== "pending") throw new AppError("Cette demande a déjà été traitée", StatusCodes.CONFLICT);

  await prisma.featuredRequest.update({
    where: { id },
    data: { status: "rejected", adminNote },
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Demande rejetée" })
  );
});
