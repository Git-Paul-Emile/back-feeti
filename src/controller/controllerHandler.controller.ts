// @ts-nocheck
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import { AppError } from "../utils/AppError.js";
import { eventControllerRepository } from "../repositories/eventController.repository.js";
import { eventService } from "../services/event.service.js";
import { eventRepository } from "../repositories/event.repository.js";
import { ticketRepository } from "../repositories/ticket.repository.js";
import { prisma } from "../config/database.js";
import bcrypt from "bcrypt";
import { fbAuth, db, FieldValue } from "../config/firebase-admin.js";

const BCRYPT_SALT = parseInt(process.env.BCRYPT_SALT || "10");

// ── Organisateur : gérer les contrôleurs d'un événement ──────────────────────

/** Créer un compte contrôleur et l'affecter à un événement */
export const createAndAssignController = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const { eventId } = req.params;
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    throw new AppError("name, email et password sont requis", StatusCodes.BAD_REQUEST);
  }

  // Vérifier que l'événement appartient à l'organisateur
  const event = await eventService.getEventById(eventId);
  if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
  if (eventId.startsWith("feeti2_live_")) {
    throw new AppError("Les événements en direct n'ont pas de contrôleurs physiques", StatusCodes.BAD_REQUEST);
  }
  if (event.organizerId !== organizerId) throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);

  // Créer ou récupérer le compte contrôleur
  let controller = await prisma.user.findUnique({ where: { email } });
  if (controller && controller.role !== "controller") {
    throw new AppError("Cet email est déjà utilisé par un autre compte", StatusCodes.CONFLICT);
  }
  if (!controller) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT);
    controller = await prisma.user.create({
      data: { name, email, phone, passwordHash, role: "controller" },
    });

    // Créer le compte Firebase Auth pour permettre la connexion via le frontend
    try {
      const fbUser = await fbAuth.createUser({ email, displayName: name, password });
      await fbAuth.setCustomUserClaims(fbUser.uid, { role: "controller" });
      controller = await prisma.user.update({
        where: { id: controller.id },
        data: { firebaseUid: fbUser.uid },
      });
      await db.collection("users").doc(fbUser.uid).set({
        uid: fbUser.uid,
        name,
        email,
        phone: phone || null,
        role: "controller",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error("[controller] Erreur création Firebase Auth:", err);
      // Le compte PostgreSQL est créé — on continue sans bloquer
    }
  }

  // Affecter à l'événement
  const assignment = await eventControllerRepository.assign(eventId, controller.id);

  res.status(StatusCodes.CREATED).json(
    jsonResponse({ status: "success", message: "Contrôleur créé et affecté", data: assignment })
  );
});

/** Affecter un contrôleur existant (par email) à un événement */
export const assignExistingController = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const { eventId } = req.params;
  const { email } = req.body;

  if (!email) throw new AppError("email requis", StatusCodes.BAD_REQUEST);

  const event = await eventService.getEventById(eventId);
  if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
  if (eventId.startsWith("feeti2_live_")) {
    throw new AppError("Les événements en direct n'ont pas de contrôleurs physiques", StatusCodes.BAD_REQUEST);
  }
  if (event.organizerId !== organizerId) throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);

  const controller = await prisma.user.findUnique({ where: { email } });
  if (!controller || controller.role !== "controller") {
    throw new AppError("Aucun contrôleur trouvé avec cet email", StatusCodes.NOT_FOUND);
  }

  const assignment = await eventControllerRepository.assign(eventId, controller.id);
  res.status(StatusCodes.CREATED).json(
    jsonResponse({ status: "success", message: "Contrôleur affecté", data: assignment })
  );
});

/** Lister les contrôleurs d'un événement */
export const listEventControllers = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const role = req.user!.role;
  const { eventId } = req.params;

  const event = await eventService.getEventById(eventId);
  if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);

  const isAdmin = role === "admin" || role === "super_admin";
  if (!isAdmin && event.organizerId !== organizerId) {
    throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
  }

  const controllers = await eventControllerRepository.findByEvent(eventId);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Contrôleurs récupérés", data: controllers })
  );
});

/** Retirer un contrôleur d'un événement */
export const removeController = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const { eventId, controllerId } = req.params;

  const event = await eventService.getEventById(eventId);
  if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
  if (event.organizerId !== organizerId) throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);

  await eventControllerRepository.remove(eventId, controllerId);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Contrôleur retiré" })
  );
});

// ── Contrôleur : son propre dashboard ────────────────────────────────────────

/** Événements assignés au contrôleur connecté */
export const getMyAssignedEvents = controllerWrapper(async (req: Request, res: Response) => {
  const controllerId = req.user!.userId;
  const assignments = await eventControllerRepository.findByController(controllerId);
  const events = assignments.map((a) => a.event);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Événements assignés récupérés", data: events })
  );
});

/** Historique des scans du contrôleur connecté */
export const getMyScanHistory = controllerWrapper(async (req: Request, res: Response) => {
  const controllerId = req.user!.userId;
  const tickets = await prisma.ticket.findMany({
    where: { scannedById: controllerId },
    include: { event: { select: { id: true, title: true, date: true, time: true, location: true } } },
    orderBy: { usedAt: "desc" },
  });
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Historique récupéré", data: tickets })
  );
});

/** Vérifier un billet (contrôleur) — uniquement pour ses événements assignés */
export const verifyTicketAsController = controllerWrapper(async (req: Request, res: Response) => {
  const controllerId = req.user!.userId;
  const { qrData } = req.body;
  if (!qrData) throw new AppError("qrData requis", StatusCodes.BAD_REQUEST);

  const ticket = await ticketRepository.findByQrData(qrData);
  if (!ticket) throw new AppError("Billet invalide ou introuvable", StatusCodes.NOT_FOUND);

  // Vérifier que ce contrôleur est bien affecté à cet événement
  const assigned = await eventControllerRepository.isAssigned(ticket.eventId, controllerId);
  if (!assigned) {
    throw new AppError("Vous n'êtes pas affecté à cet événement", StatusCodes.FORBIDDEN);
  }

  if (ticket.status === "used") throw new AppError("Ce billet a déjà été utilisé", StatusCodes.BAD_REQUEST);
  if (ticket.status === "expired") throw new AppError("Ce billet est expiré", StatusCodes.BAD_REQUEST);
  if (ticket.status !== "valid") throw new AppError("Ce billet n'est pas valide", StatusCodes.BAD_REQUEST);

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: "used", usedAt: new Date(), scannedById: controllerId },
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Billet validé avec succès", data: updated })
  );
});
