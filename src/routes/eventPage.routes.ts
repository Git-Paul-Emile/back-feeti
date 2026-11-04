import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import { validateBody } from "../middlewares/validateBody.js";
import { updateEventPageSchema } from "../validators/eventPage.validator.js";
import {
  getPublicEventPage,
  getSlugRedirect,
  checkSlugAvailable,
  getOrganizerEventPage,
  updateOrganizerEventPage,
  createPreviewToken,
} from "../controller/eventPage.controller.js";

// ─── /api/public : lecture sans authentification, mise en cache ──────────────
export const publicEventPageRouter = Router();
publicEventPageRouter.get("/events/by-slug/:slug", getPublicEventPage);
publicEventPageRouter.get("/slugs/:slug/redirect", getSlugRedirect);

// ─── /api/organizer/event-pages : organisateur propriétaire ou admin ─────────
export const organizerEventPageRouter = Router();
const ORGANIZER_ROLES = ["organizer", "admin", "super_admin"];

// Vérification « en direct » pendant la frappe : limite dédiée
const slugCheckLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

organizerEventPageRouter.use(authenticate, requireRole(...ORGANIZER_ROLES));
organizerEventPageRouter.get("/slug-available", slugCheckLimiter, checkSlugAvailable); // avant /:eventId
organizerEventPageRouter.get("/:eventId", getOrganizerEventPage);
organizerEventPageRouter.patch("/:eventId", validateBody(updateEventPageSchema), updateOrganizerEventPage);
organizerEventPageRouter.post("/:eventId/preview-token", createPreviewToken);
