import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/database.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { firestoreSyncService } from "../services/firestore-sync.service.js";

const FEETIPLAY_SYNC_SECRET = process.env.FEETI_SYNC_SECRET || "";

function verifySyncSecret(req: Request): void {
  const provided = req.headers["x-feeti-sync-secret"] as string;
  if (provided !== FEETIPLAY_SYNC_SECRET) {
    throw new AppError("Secret de synchronisation invalide", StatusCodes.FORBIDDEN);
  }
}

/**
 * GET /api/integration/streaming-events
 * Expose les événements feeti2 avec streamUrl ou isLive=true
 * Consommé par feetiPlay pour synchroniser le catalogue.
 */
export const getStreamingEvents = controllerWrapper(async (_req: Request, res: Response) => {
  const events = await prisma.event.findMany({
    where: {
      status: "published",
      eventType: { not: "PRESENTIEL" },
      OR: [
        { isLive: true },
        { streamUrl: { not: null } },
        { videoUrl: { not: null } },
        { eventType: "MIXTE" },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      date: true,
      time: true,
      duration: true,
      image: true,
      category: true,
      eventType: true,
      isLive: true,
      streamUrl: true,
      videoUrl: true,
      price: true,
      currency: true,
      organizer: { select: { name: true } },
      country: { select: { name: true, code: true } },
      createdAt: true,
    },
    orderBy: [{ isLive: "desc" }, { createdAt: "desc" }],
  });

  const mapped = events.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date,
    time: e.time,
    duration: e.duration ?? "",
    image: e.image,
    category: e.category,
    eventType: (e.eventType === "MIXTE" ? "MIXTE" : "STREAMING_LIVE") as "STREAMING_LIVE" | "MIXTE",
    isLive: e.isLive,
    isFeatured: false,
    streamUrl: e.streamUrl ?? null,
    videoUrl: e.videoUrl ?? null,
    isFree: e.price === 0,
    price: e.price,
    currency: e.currency,
    channelName: e.organizer?.name ?? "Fééti",
    country: e.country?.name ?? null,
    source: "feeti2" as const,
  }));

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Événements streaming récupérés", data: mapped })
  );
});

export const syncFavoriteFromFeetiPlay = controllerWrapper(async (req: Request, res: Response) => {
  verifySyncSecret(req);

  const { userId, eventId } = req.body as { userId: string; eventId: string };

  if (!userId || !eventId) {
    throw new AppError("userId et eventId requis", StatusCodes.BAD_REQUEST);
  }

  const FEETIPLAY_LIVE_ID_PREFIX = "feeti2_live_";

  // Si l'ID a le préfixe, on l'enlève pour chercher dans PostgreSQL
  const localEventId = eventId.startsWith(FEETIPLAY_LIVE_ID_PREFIX)
    ? eventId.replace(FEETIPLAY_LIVE_ID_PREFIX, "")
    : eventId;

  // Résoudre le Firebase UID vers un userId PostgreSQL
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: userId }, { firebaseUid: userId }] },
  });

  if (!user) {
    // On stocke le favori avec l'ID tel quel - il pourra être résolu plus tard
    logger.warn(`[sync] Utilisateur ${userId} introuvable pour le favori - stocké avec firebaseUid`);
  }

  const effectiveUserId = user?.id ?? userId;

  // Vérifier si l'événement existe localement (optionnel - on accepte les favoris de n'importe quel eventId)
  const event = await prisma.event.findUnique({
    where: { id: localEventId },
  });

  if (!event) {
    logger.warn(`[sync] Événement ${localEventId} introuvable localement - favori stocké quand même`);
  }

  const existing = await prisma.userFavorite.findUnique({
    where: { userId_eventId: { userId: effectiveUserId, eventId: localEventId } },
  });

  if (!existing) {
    await prisma.userFavorite.create({
      data: { userId: effectiveUserId, eventId: localEventId },
    });
  }

  firestoreSyncService.syncDocument({
    collection: "user_favorites",
    id: `${userId}-${eventId}`,
    data: {
      userId,
      eventId,
      createdAt: new Date().toISOString(),
    },
  }).catch((err) => {
    logger.error("[sync] Erreur sync Firestore favori:", err);
  });

  logger.info(`[sync] Favori synchronisé: user=${userId}, event=${eventId}`);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Favori synchronisé", data: { synced: true } })
  );
});

export const syncTicketFromFeetiPlay = controllerWrapper(async (req: Request, res: Response) => {
  verifySyncSecret(req);

  const {
    id,
    eventId,
    userId, // Firebase UID
    category,
    price,
    currency,
    holderName,
    holderEmail,
    qrData,
    orderId,
    deliveryMethod,
  } = req.body as {
    id: string;
    eventId: string;
    userId: string;
    category: string;
    price: number;
    currency: string;
    holderName: string;
    holderEmail: string;
    qrData: string;
    orderId: string;
    deliveryMethod?: "email" | "physical";
  };

  if (!id || !eventId || !userId || !holderName || !holderEmail || !qrData || !orderId) {
    throw new AppError("Données de billet incomplètes", StatusCodes.BAD_REQUEST);
  }

  const FEETIPLAY_LIVE_ID_PREFIX = "feeti2_live_";
  const localEventId = eventId.startsWith(FEETIPLAY_LIVE_ID_PREFIX)
    ? eventId.replace(FEETIPLAY_LIVE_ID_PREFIX, "")
    : eventId;

  // Résoudre le Firebase UID vers un userId PostgreSQL
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: userId }, { firebaseUid: userId }] },
  });

  if (!user) {
    throw new AppError(`Utilisateur ${userId} introuvable`, StatusCodes.NOT_FOUND);
  }

  const ticket = await prisma.ticket.upsert({
    where: { id },
    create: {
      id,
      eventId: localEventId,
      userId: user.id,
      category,
      price,
      currency,
      holderName,
      holderEmail,
      qrData,
      orderId,
      deliveryMethod: deliveryMethod ?? "email",
    },
    update: {
      category,
      price,
      currency,
      holderName,
      holderEmail,
      qrData,
      orderId,
      deliveryMethod: deliveryMethod ?? "email",
    },
  });

  logger.info(`[sync] Billet synchronisé: ticket=${ticket.id}, event=${eventId}, user=${user.id}`);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Billet synchronisé", data: { synced: true } })
  );
});