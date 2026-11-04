import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { eventPageService } from "../services/eventPage.service.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import { AppError } from "../utils/AppError.js";

const PUBLIC_CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

// ─── Public ──────────────────────────────────────────────────────────────────

// GET /api/public/events/by-slug/:slug[?preview=<token>]
export const getPublicEventPage = controllerWrapper(async (req: Request, res: Response) => {
  const preview = typeof req.query.preview === "string" ? req.query.preview : undefined;
  const result = await eventPageService.getPublicPage(String(req.params.slug), preview);

  if (result.kind === "redirect") {
    res.set("Cache-Control", PUBLIC_CACHE);
    res.status(StatusCodes.OK).json(
      jsonResponse({ status: "success", message: "Lien renommé", data: { redirect: { slug: result.slug } } }),
    );
    return;
  }
  if (result.kind === "gone") {
    res.set("Cache-Control", PUBLIC_CACHE);
    throw new AppError("Cette page n'est plus disponible", StatusCodes.GONE);
  }

  // Un aperçu privé ne doit jamais être mis en cache par un CDN
  res.set("Cache-Control", result.preview ? "private, no-store" : PUBLIC_CACHE);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Page événement", data: result.data }));
});

// GET /api/public/slugs/:slug/redirect
export const getSlugRedirect = controllerWrapper(async (req: Request, res: Response) => {
  const target = await eventPageService.resolveRedirect(String(req.params.slug));
  if (!target) throw new AppError("Aucune redirection pour ce lien", StatusCodes.NOT_FOUND);
  res.set("Cache-Control", PUBLIC_CACHE);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Redirection", data: { slug: target } }));
});

// ─── Organisateur ────────────────────────────────────────────────────────────

// GET /api/organizer/event-pages/slug-available?slug=&eventId=
export const checkSlugAvailable = controllerWrapper(async (req: Request, res: Response) => {
  const slug = typeof req.query.slug === "string" ? req.query.slug : "";
  const eventId = typeof req.query.eventId === "string" ? req.query.eventId : undefined;
  const data = await eventPageService.checkSlugAvailability(slug, req.user!, eventId);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Disponibilité du lien", data }));
});

// GET /api/organizer/event-pages/:eventId
export const getOrganizerEventPage = controllerWrapper(async (req: Request, res: Response) => {
  const data = await eventPageService.getForOrganizer(String(req.params.eventId), req.user!);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Page événement", data }));
});

// PATCH /api/organizer/event-pages/:eventId
export const updateOrganizerEventPage = controllerWrapper(async (req: Request, res: Response) => {
  const data = await eventPageService.updateForOrganizer(String(req.params.eventId), req.user!, req.body);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Page événement mise à jour", data }));
});

// POST /api/organizer/event-pages/:eventId/preview-token
export const createPreviewToken = controllerWrapper(async (req: Request, res: Response) => {
  const data = await eventPageService.createPreviewToken(String(req.params.eventId), req.user!);
  res.status(StatusCodes.CREATED).json(jsonResponse({ status: "success", message: "Lien d'aperçu créé (24 h)", data }));
});
