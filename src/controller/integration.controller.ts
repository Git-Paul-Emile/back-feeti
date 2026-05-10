import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/database.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";

/**
 * GET /api/integration/streaming-events
 * Expose les événements feeti2 avec streamUrl ou isLive=true
 * Consommé par feetiPlay pour synchroniser le catalogue.
 */
export const getStreamingEvents = controllerWrapper(async (_req: Request, res: Response) => {
  const events = await prisma.event.findMany({
    where: {
      status: "published",
      OR: [
        { isLive: true },
        { streamUrl: { not: null } },
        { videoUrl: { not: null } },
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
      isLive: true,
      isFeatured: true,
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
    isLive: e.isLive,
    isFeatured: e.isFeatured,
    streamUrl: e.streamUrl ?? null,
    videoUrl: e.videoUrl ?? null,
    isFree: e.price === 0,
    price: e.price,
    currency: e.currency,
    channelName: e.organizer?.name ?? "Féeti",
    country: e.country?.name ?? null,
    source: "feeti2" as const,
  }));

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Événements streaming récupérés", data: mapped })
  );
});
