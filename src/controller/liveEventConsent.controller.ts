import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { liveEventConsentService, type LiveEventType } from "../services/liveEventConsent.service.js";
import { AppError } from "../utils/AppError.js";

const LIVE_EVENT_TYPES: LiveEventType[] = ["STREAMING_LIVE", "MIXTE"];

/**
 * POST /api/live-event-consent/request-forms
 * Demande l'envoi des formulaires PDF pour un événement live/mixte.
 */
export async function requestLiveForms(req: Request, res: Response, next: NextFunction) {
  try {
    const { organizerEmail, eventName, eventType } = req.body;

    if (!organizerEmail || !eventName || !eventType) {
      throw new AppError("organizerEmail, eventName et eventType sont requis.", StatusCodes.BAD_REQUEST);
    }

    if (!LIVE_EVENT_TYPES.includes(eventType)) {
      throw new AppError(
        `eventType doit être l'un de : ${LIVE_EVENT_TYPES.join(", ")}`,
        StatusCodes.BAD_REQUEST
      );
    }

    const result = await liveEventConsentService.requestLiveForms({
      organizerEmail,
      eventName,
      eventType,
    });

    const status = result.success ? StatusCodes.OK : StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/live-event-consent/consent
 * Enregistre le consentement de l'organisateur pour la diffusion live/mixte.
 */
export async function recordConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const { organizerEmail, eventName, eventType, consentGiven } = req.body;

    if (!organizerEmail || !eventName || !eventType) {
      throw new AppError("organizerEmail, eventName et eventType sont requis.", StatusCodes.BAD_REQUEST);
    }

    if (!LIVE_EVENT_TYPES.includes(eventType)) {
      throw new AppError(
        `eventType doit être l'un de : ${LIVE_EVENT_TYPES.join(", ")}`,
        StatusCodes.BAD_REQUEST
      );
    }

    if (consentGiven !== true) {
      throw new AppError(
        "Le consentement est obligatoire pour les événements en Streaming Live ou Mixte.",
        StatusCodes.BAD_REQUEST
      );
    }

    const result = await liveEventConsentService.recordConsent({
      organizerEmail,
      eventName,
      eventType,
      consentGiven: true,
    });

    const status = result.success ? StatusCodes.OK : StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
}
