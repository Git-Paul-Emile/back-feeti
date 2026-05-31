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
import { emailService } from "../services/email.service.js";

const BCRYPT_SALT = parseInt(process.env.BCRYPT_SALT || "10");
const FRONT_URL = process.env.FRONT_URL || "http://localhost:5173";

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
  const isNewController = !controller;
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

  // Envoyer les identifiants par email (non bloquant)
  if (isNewController) {
    emailService.sendWelcomeController(email, {
      controllerName: name,
      email,
      password,
      eventTitle: event.title,
      loginUrl: `${FRONT_URL}/login`,
    }).catch(err => console.error("[controller] Erreur envoi email identifiants:", err));
  }

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
  const role = req.user!.role;
  const { eventId, controllerId } = req.params;

  const event = await eventService.getEventById(eventId);
  if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);

  const isAdmin = role === "admin" || role === "super_admin";
  if (!isAdmin && event.organizerId !== organizerId) {
    throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
  }

  try {
    await eventControllerRepository.remove(eventId, controllerId);
  } catch (err: any) {
    throw new AppError(err.message || "Affectation introuvable", StatusCodes.NOT_FOUND);
  }

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Contrôleur retiré" })
  );
});

/** Modifier les infos d'un contrôleur (nom, téléphone, mot de passe) */
export const updateController = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const role = req.user!.role;
  const { eventId, controllerId } = req.params;
  const { name, phone, password } = req.body;

  const event = await eventService.getEventById(eventId);
  if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);

  const isAdmin = role === "admin" || role === "super_admin";
  if (!isAdmin && event.organizerId !== organizerId) {
    throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
  }

  const assignment = await eventControllerRepository.findAssignment(eventId, controllerId);
  if (!assignment) throw new AppError("Ce contrôleur n'est pas affecté à cet événement", StatusCodes.NOT_FOUND);

  const updateData: any = {};
  if (name) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone || null;
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, BCRYPT_SALT);
    // Mettre à jour le mot de passe Firebase aussi
    try {
      const user = await prisma.user.findUnique({ where: { id: controllerId } });
      if (user?.firebaseUid) {
        await fbAuth.updateUser(user.firebaseUid, { password });
      }
    } catch (err) {
      console.error("[controller] Erreur update Firebase password:", err);
    }
  }

  const updated = await prisma.user.update({
    where: { id: controllerId },
    data: updateData,
    select: { id: true, name: true, email: true, phone: true },
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Contrôleur mis à jour", data: updated })
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

  // Chercher d'abord par qrData exact (scan caméra → JSON signé)
  let ticket = await ticketRepository.findByQrData(qrData);

  // Fallback saisie manuelle
  if (!ticket) {
    const input = qrData.trim();
    // Cas 1 : JSON signé avec ticketId (scan partiel ou copier-coller)
    try {
      const parsed = JSON.parse(input);
      if (parsed?.ticketId) {
        ticket = await prisma.ticket.findUnique({
          where: { id: parsed.ticketId },
          include: { event: true, user: true },
        });
      }
    } catch { /* pas du JSON */ }

    // Cas 2 : N° court affiché sur le billet (8 derniers chars de l'id, ex: "YEM4RBZ8")
    if (!ticket && /^[A-Z0-9]{8}$/i.test(input)) {
      ticket = await prisma.ticket.findFirst({
        where: { id: { endsWith: input.toLowerCase() } },
        include: { event: true, user: true },
      });
    }

    // Cas 3 : UUID complet collé manuellement
    if (!ticket) {
      ticket = await prisma.ticket.findUnique({
        where: { id: input },
        include: { event: true, user: true },
      }).catch(() => null);
    }
  }

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
