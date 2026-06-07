import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import {
  createAndAssignController,
  assignExistingController,
  listEventControllers,
  listAllControllers,
  removeController,
  updateController,
  getMyAssignedEvents,
  getMyScanHistory,
  verifyTicketAsController,
} from "../controller/controllerHandler.controller.js";

const router = Router();

// ── Liste globale des contrôleurs (pour organisateur) ────────────────────────
router.get(
  "/all",
  authenticate,
  requireRole("organizer", "admin", "super_admin"),
  listAllControllers
);

// ── Organisateur : gérer les contrôleurs d'un événement ──────────────────────
router.post(
  "/events/:eventId/controllers",
  authenticate,
  requireRole("organizer", "admin", "super_admin"),
  createAndAssignController
);

router.post(
  "/events/:eventId/controllers/assign",
  authenticate,
  requireRole("organizer", "admin", "super_admin"),
  assignExistingController
);

router.get(
  "/events/:eventId/controllers",
  authenticate,
  requireRole("organizer", "admin", "super_admin"),
  listEventControllers
);

router.delete(
  "/events/:eventId/controllers/:controllerId",
  authenticate,
  requireRole("organizer", "admin", "super_admin"),
  removeController
);

router.patch(
  "/events/:eventId/controllers/:controllerId",
  authenticate,
  requireRole("organizer", "admin", "super_admin"),
  updateController
);

// ── Contrôleur : son dashboard ────────────────────────────────────────────────
router.get("/my-events", authenticate, requireRole("controller"), getMyAssignedEvents);
router.get("/my-scans", authenticate, requireRole("controller"), getMyScanHistory);
router.post("/verify", authenticate, requireRole("controller"), verifyTicketAsController);

export default router;
