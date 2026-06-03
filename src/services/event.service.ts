import { StatusCodes } from "http-status-codes";
import { randomUUID } from "crypto";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { eventRepository } from "../repositories/event.repository.js";
import { ticketRepository } from "../repositories/ticket.repository.js";
import { prisma } from "../config/database.js";
import { feetiPlaySyncService } from "./feetiPlaySync.service.js";
import { firestoreSyncService } from "./firestore-sync.service.js";

const FEETIPLAY_LIVE_ID_PREFIX = "feeti2_live_";

function isFeetiPlayLiveId(id: string) {
  return id.startsWith(FEETIPLAY_LIVE_ID_PREFIX);
}

function mapSyncedLiveEvent(event: Awaited<ReturnType<typeof feetiPlaySyncService.getLiveEventById>>) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date,
    time: event.time,
    location: event.location,
    image: event.image,
    price: event.price,
    currency: event.currency,
    category: event.category,
    maxAttendees: 999999,
    attendees: 0,
    duration: event.duration,
    salesBlocked: false,
    isLive: event.isLive,
    eventType: "STREAMING_LIVE" as const,
    isFavorite: false,
    // isLive=true → en cours ; isReplay=true → terminé ; sinon → à venir (draft côté feeti2)
    status: event.isLive ? "published" : (event.isReplay ? "completed" : "draft"),
    streamUrl: event.streamUrl ?? undefined,
    videoUrl: event.videoUrl ?? undefined,
    countryCode: undefined,
    organizerId: event.organizerId,
    organizer: { name: event.channelName },
    createdAt: event.createdAt,
    updatedAt: event.updatedAt ?? event.createdAt,
  };
}

export const eventService = {
  async createEvent(data: {
    id?: string;
    title: string;
    description: string;
    date: string;
    time: string;
    location: string;
    image?: string;
    price?: number;
    vipPrice?: number;
    ticketTypes?: string;
    currency?: string;
    category: string;
    eventType?: "PRESENTIEL" | "STREAMING_LIVE" | "MIXTE";
    maxAttendees: number;
    duration?: string;
    isLive?: boolean;
    streamUrl?: string;
    videoUrl?: string;
    countryCode?: string;
    organizerId: string;
    featuredHomepage?: boolean;
    isPrivateForBadges?: boolean;
  }) {
    const targetEventType = data.eventType ?? (data.isLive ? "STREAMING_LIVE" : "PRESENTIEL");
    const needsFeetiPlaySync = targetEventType === "STREAMING_LIVE" || targetEventType === "MIXTE";

    // Tous les types créent un enregistrement PostgreSQL en draft.
    // Les événements privés ont les ventes bloquées par défaut.
    const event = await eventRepository.create({
      ...data,
      id: data.id ?? (needsFeetiPlaySync ? randomUUID() : undefined),
      eventType: targetEventType,
      isLive: needsFeetiPlaySync,
      status: "draft",
      salesBlocked: data.isPrivateForBadges ? true : (data as any).salesBlocked ?? false,
    });

    // Synchroniser dans Firestore
    await firestoreSyncService.syncEvent(event).catch((err) => {
      logger.error(`Erreur sync Firestore pour event ${event.id}:`, err);
    });

    // Pour STREAMING_LIVE et MIXTE : créer immédiatement dans FeetiPlay
    // avec isLive: false (événement "à venir", visible mais pas encore en direct).
    // Le passage à isLive: true se fait quand l'organisateur démarre le stream.
    if (needsFeetiPlaySync) {
      const organizer = await prisma.user.findUnique({
        where: { id: data.organizerId },
        select: { name: true },
      });
      feetiPlaySyncService.upsertLiveEvent({
        id: `${FEETIPLAY_LIVE_ID_PREFIX}${event.id}`,
        title: event.title,
        description: event.description,
        date: event.date,
        time: event.time,
        duration: event.duration ?? "",
        image: event.image,
        category: event.category,
        isLive: false,
        isFeatured: false,
        streamUrl: event.streamUrl ?? undefined,
        videoUrl: event.videoUrl ?? undefined,
        price: event.price,
        currency: event.currency,
        organizerId: event.organizerId,
        organizerName: organizer?.name ?? "Organisateur",
        location: event.location,
      }).catch((err) => {
        logger.error(`Erreur sync FeetiPlay pour event ${event.id}:`, err);
      });
    }

    return event;
  },

  async getOrganizerEvents(organizerId: string) {
    const [localEvents, liveEvents] = await Promise.all([
      eventRepository.findByOrganizer(organizerId),
      feetiPlaySyncService.listOrganizerLiveEvents(organizerId).catch(() => []),
    ]);

    // Évite les doublons pour les événements MIXTE (miroirs FeetiPlay).
    const localMirrorIds = new Set(localEvents.map((e) => `${FEETIPLAY_LIVE_ID_PREFIX}${e.id}`));
    const filteredLive = liveEvents.filter((e) => !localMirrorIds.has(e.id));

    return [
      ...localEvents,
      ...filteredLive.map(mapSyncedLiveEvent),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getAllEvents(countryCode?: string, interests?: string[]) {
    return eventRepository.findAll(countryCode, interests);
  },

  async getEventById(id: string) {
    if (isFeetiPlayLiveId(id)) {
      try {
        return mapSyncedLiveEvent(await feetiPlaySyncService.getLiveEventById(id));
      } catch {
        // Fallback: ancien lien live alors que l'événement existe localement (mixte matérialisé).
        const localId = id.replace(FEETIPLAY_LIVE_ID_PREFIX, "");
        const local = await eventRepository.findById(localId);
        if (local) return local;
        // Compatibilité legacy: certains enregistrements ont été créés avec l'ID préfixé.
        return eventRepository.findById(id);
      }
    }
    return eventRepository.findById(id);
  },

  async deleteEvent(eventId: string, organizerId: string, role?: string) {
    if (isFeetiPlayLiveId(eventId)) {
      const event = await feetiPlaySyncService.getLiveEventById(eventId);
      const isAdmin = role === "admin" || role === "super_admin";
      if (!isAdmin && event.organizerId !== organizerId) {
        throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
      }
      await feetiPlaySyncService.deleteLiveEvent(eventId);
      return;
    }

    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
    }
    const isAdmin = role === "admin" || role === "super_admin";
    if (!isAdmin && event.organizerId !== organizerId) {
      throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
    }
    // Organisateur ne peut pas supprimer si des billets ont été vendus
    if (!isAdmin) {
      const ticketCount = await ticketRepository.countByEvent(eventId);
      if (ticketCount > 0) {
        throw new AppError(
          `Impossible de supprimer : ${ticketCount} billet(s) déjà vendu(s) pour cet événement`,
          StatusCodes.CONFLICT
        );
      }
    }
    
    // Supprimer de PostgreSQL
    const deleted = await eventRepository.delete(eventId);

    // Supprimer de Firestore
    await firestoreSyncService.deleteDocument('events', eventId).catch((err) => {
      logger.error(`Erreur suppression Firestore pour event ${eventId}:`, err);
    });

    // Pour STREAMING_LIVE et MIXTE : supprimer aussi le miroir FeetiPlay
    if (event.eventType === "STREAMING_LIVE" || event.eventType === "MIXTE") {
      await feetiPlaySyncService.deleteLiveEvent(`${FEETIPLAY_LIVE_ID_PREFIX}${eventId}`).catch(() => {});
    }

    return deleted;
  },

  async toggleSalesBlocked(eventId: string, organizerId: string, role?: string) {
    if (isFeetiPlayLiveId(eventId)) {
      const event = await feetiPlaySyncService.getLiveEventById(eventId);
      const isAdmin = role === "admin" || role === "super_admin";
      if (!isAdmin && event.organizerId !== organizerId) {
        throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
      }
      return { salesBlocked: false };
    }

    const event = await eventRepository.findById(eventId);
    if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
    const isAdmin = role === "admin" || role === "super_admin";
    if (!isAdmin && event.organizerId !== organizerId) {
      throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
    }
    const newBlocked = !(event as any).salesBlocked;
    await eventRepository.update(eventId, { salesBlocked: newBlocked });
    return { salesBlocked: newBlocked };
  },

  async toggleFavorite(userId: string, eventId: string) {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
    }
    const isFavorited = await eventRepository.toggleFavorite(userId, eventId);
    return { isFavorited };
  },

  async isFavorited(userId: string, eventId: string) {
    return eventRepository.isFavorited(userId, eventId);
  },

  async getMyFavorites(userId: string) {
    return eventRepository.findFavoritesByUser(userId);
  },

  async updateEvent(
    eventId: string,
    organizerId: string,
    data: Partial<{
      title: string;
      description: string;
      date: string;
      time: string;
      location: string;
      image: string;
      price: number;
      vipPrice: number;
      ticketTypes: string;
      currency: string;
      category: string;
      eventType: "PRESENTIEL" | "STREAMING_LIVE" | "MIXTE";
      maxAttendees: number;
      duration: string;
      isLive: boolean;
      streamUrl: string;
      videoUrl: string;
      status: string;
      countryCode: string | null;
    }>,
    role?: string
  ) {
    if (isFeetiPlayLiveId(eventId)) {
      const event = await feetiPlaySyncService.getLiveEventById(eventId);
      const isAdmin = role === "admin" || role === "super_admin";
      if (!isAdmin && event.organizerId !== organizerId) {
        throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
      }

      const organizer = await prisma.user.findUnique({
        where: { id: organizerId },
        select: { name: true },
      });

      const localId = eventId.replace(FEETIPLAY_LIVE_ID_PREFIX, "");
      // Un événement FeetiPlay visible est considéré publié — la modification
      // ne doit pas repasser par une validation admin.
      const preservedStatus = "published";
      const targetType = data.eventType ?? "STREAMING_LIVE";

      if (data.isLive === false || targetType === "PRESENTIEL") {
        // Conversion vers PRESENTIEL : supprime FeetiPlay, crée record local pur
        await feetiPlaySyncService.deleteLiveEvent(eventId);
        return eventRepository.create({
          id: localId,
          title: data.title ?? event.title,
          description: data.description ?? event.description,
          date: data.date ?? event.date,
          time: data.time ?? event.time,
          location: data.location ?? event.location,
          image: data.image ?? event.image,
          price: data.price ?? event.price,
          vipPrice: data.vipPrice,
          ticketTypes: data.ticketTypes,
          currency: data.currency ?? event.currency,
          category: data.category ?? event.category,
          eventType: "PRESENTIEL",
          maxAttendees: data.maxAttendees ?? 100,
          duration: data.duration ?? event.duration,
          isLive: false,
          streamUrl: undefined,
          videoUrl: undefined,
          countryCode: data.countryCode ?? undefined,
          status: preservedStatus,
          organizerId,
        });
      }

      if (targetType === "MIXTE") {
        // Conversion vers MIXTE : crée/met à jour le record PostgreSQL local
        // ET conserve le miroir FeetiPlay
        const existingLocal = await eventRepository.findById(localId);
        const localEvent = existingLocal
          ? await eventRepository.update(localId, {
              title: data.title ?? event.title,
              description: data.description ?? event.description,
              date: data.date ?? event.date,
              time: data.time ?? event.time,
              location: data.location ?? event.location,
              image: data.image ?? event.image,
              price: data.price ?? event.price,
              vipPrice: data.vipPrice,
              ticketTypes: data.ticketTypes,
              currency: data.currency ?? event.currency,
              category: data.category ?? event.category,
              eventType: "MIXTE",
              maxAttendees: data.maxAttendees ?? 100,
              duration: data.duration ?? event.duration ?? undefined,
              isLive: true,
              streamUrl: data.streamUrl ?? event.streamUrl ?? undefined,
              videoUrl: data.videoUrl ?? event.videoUrl ?? undefined,
              countryCode: data.countryCode ?? undefined,
            })
          : await eventRepository.create({
              id: localId,
              title: data.title ?? event.title,
              description: data.description ?? event.description,
              date: data.date ?? event.date,
              time: data.time ?? event.time,
              location: data.location ?? event.location,
              image: data.image ?? event.image,
              price: data.price ?? event.price,
              vipPrice: data.vipPrice,
              ticketTypes: data.ticketTypes,
              currency: data.currency ?? event.currency,
              category: data.category ?? event.category,
              eventType: "MIXTE",
              maxAttendees: data.maxAttendees ?? 100,
              duration: data.duration ?? event.duration,
              isLive: true,
              streamUrl: data.streamUrl ?? event.streamUrl ?? undefined,
              videoUrl: data.videoUrl ?? event.videoUrl ?? undefined,
              countryCode: data.countryCode ?? undefined,
              status: preservedStatus,
              organizerId,
            });

        await feetiPlaySyncService.upsertLiveEvent({
          id: eventId,
          title: localEvent.title,
          description: localEvent.description,
          date: localEvent.date,
          time: localEvent.time,
          duration: localEvent.duration ?? "",
          image: localEvent.image,
          category: localEvent.category,
          isLive: true,
          isFeatured: false,
          streamUrl: localEvent.streamUrl ?? undefined,
          videoUrl: localEvent.videoUrl ?? undefined,
          price: localEvent.price,
          currency: localEvent.currency,
          organizerId,
          organizerName: organizer?.name ?? event.channelName,
          location: localEvent.location,
        });

        return localEvent;
      }

      // STREAMING_LIVE : mise à jour FeetiPlay uniquement
      const syncedEvent = await feetiPlaySyncService.upsertLiveEvent({
        id: eventId,
        title: data.title ?? event.title,
        description: data.description ?? event.description,
        date: data.date ?? event.date,
        time: data.time ?? event.time,
        duration: data.duration ?? event.duration,
        image: data.image ?? event.image,
        category: data.category ?? event.category,
        isLive: data.isLive ?? event.isLive,
        isFeatured: false,
        streamUrl: data.streamUrl ?? event.streamUrl ?? undefined,
        videoUrl: data.videoUrl ?? event.videoUrl ?? undefined,
        price: data.price ?? event.price,
        currency: data.currency ?? event.currency,
        organizerId,
        organizerName: organizer?.name ?? event.channelName,
        location: data.location ?? event.location,
      });

      // Met à jour le record PostgreSQL local si présent (suite au fix de conservation)
      const existingLocalEvent = await eventRepository.findById(localId);
      if (existingLocalEvent) {
        await eventRepository.update(localId, {
          title: data.title ?? event.title,
          description: data.description ?? event.description,
          date: data.date ?? event.date,
          time: data.time ?? event.time,
          location: data.location ?? event.location,
          image: data.image ?? event.image,
          price: data.price ?? event.price,
          vipPrice: data.vipPrice,
          ticketTypes: data.ticketTypes,
          currency: data.currency ?? event.currency,
          category: data.category ?? event.category,
          eventType: "STREAMING_LIVE",
          maxAttendees: data.maxAttendees ?? 100,
          duration: data.duration ?? event.duration ?? undefined,
          isLive: true,
          streamUrl: data.streamUrl ?? event.streamUrl ?? undefined,
          videoUrl: data.videoUrl ?? event.videoUrl ?? undefined,
        });
      }

      return mapSyncedLiveEvent(syncedEvent);
    }

    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
    }
    const isAdmin = role === "admin" || role === "super_admin";
    if (!isAdmin && event.organizerId !== organizerId) {
      throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
    }
    const targetEventType = data.eventType ?? (data.isLive ? "STREAMING_LIVE" : event.eventType);

    if (targetEventType === "STREAMING_LIVE") {
      const organizer = await prisma.user.findUnique({
        where: { id: organizerId },
        select: { name: true },
      });

      const syncedEvent = await feetiPlaySyncService.upsertLiveEvent({
        id: `${FEETIPLAY_LIVE_ID_PREFIX}${eventId}`,
        title: data.title ?? event.title,
        description: data.description ?? event.description,
        date: data.date ?? event.date,
        time: data.time ?? event.time,
        duration: data.duration ?? event.duration ?? "",
        image: data.image ?? event.image,
        category: data.category ?? event.category,
        isLive: true,
        isFeatured: false,
        streamUrl: data.streamUrl ?? event.streamUrl ?? undefined,
        videoUrl: data.videoUrl ?? event.videoUrl ?? undefined,
        price: data.price ?? event.price,
        currency: data.currency ?? event.currency,
        organizerId,
        organizerName: organizer?.name ?? event.organizer?.name ?? "Organisateur",
        location: data.location ?? event.location,
      });

      // On garde le record PostgreSQL local (nécessaire pour le système de promotion,
      // les transactions financières, etc.). La déduplication dans getOrganizerEvents
      // filtre déjà les miroirs FeetiPlay quand un record local existe.
      await eventRepository.update(eventId, {
        title: data.title ?? event.title,
        description: data.description ?? event.description,
        date: data.date ?? event.date,
        time: data.time ?? event.time,
        location: data.location ?? event.location,
        image: data.image ?? event.image,
        price: data.price ?? event.price,
        vipPrice: data.vipPrice,
        ticketTypes: data.ticketTypes,
        currency: data.currency ?? event.currency,
        category: data.category ?? event.category,
        eventType: "STREAMING_LIVE",
        maxAttendees: data.maxAttendees ?? event.maxAttendees,
        duration: data.duration ?? event.duration ?? undefined,
        isLive: true,
        streamUrl: data.streamUrl ?? event.streamUrl ?? undefined,
        videoUrl: data.videoUrl ?? event.videoUrl ?? undefined,
        countryCode: data.countryCode ?? event.countryCode,
      });
      return mapSyncedLiveEvent(syncedEvent);
    }

    // Un organisateur ne peut pas changer le statut — seul l'admin peut via /api/admin/events/:id/status
    const { status: _ignoredStatus, ...safeData } = data as typeof data & { status?: string };
    const updated = await eventRepository.update(eventId, {
      ...(!isAdmin ? safeData : data),
      eventType: targetEventType,
      isLive: targetEventType === "MIXTE" ? true : data.isLive,
    });

    // Pour MIXTE: maintenir le miroir live.
    if (targetEventType === "MIXTE") {
      const organizer = await prisma.user.findUnique({
        where: { id: organizerId },
        select: { name: true },
      });
      await feetiPlaySyncService.upsertLiveEvent({
        id: `${FEETIPLAY_LIVE_ID_PREFIX}${eventId}`,
        title: updated.title,
        description: updated.description,
        date: updated.date,
        time: updated.time,
        duration: updated.duration ?? "",
        image: updated.image,
        category: updated.category,
        isLive: updated.isLive,
        isFeatured: false,
        streamUrl: updated.streamUrl ?? undefined,
        videoUrl: updated.videoUrl ?? undefined,
        price: updated.price,
        currency: updated.currency,
        organizerId: updated.organizerId,
        organizerName: organizer?.name ?? "Organisateur",
        location: updated.location,
      });
    }

    return updated;
  },
};
