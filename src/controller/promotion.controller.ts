/**
 * promotion.controller.ts
 * Gestion self-service des promotions par les organisateurs
 */
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/database.js";
import { AppError } from "../utils/AppError.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";

// ─── Configs par défaut si aucune n'est en base ──────────────────────────────
const DEFAULT_PACK_CONFIGS: Record<string, {
  price: number; currency: string; description: string;
  advantages: string[]; durationDays: number;
}> = {
  OR: {
    price: 49000,
    currency: "FCFA",
    description: "La vitrine premium de vos événements — visibilité maximale sur toute la plateforme Feeti.",
    advantages: [
      "Position #1 sur la homepage",
      "Bannière dans la catégorie de l'événement",
      "Inclusion dans la newsletter Feeti",
      "Résultats de recherche prioritaires",
      "Badge OR affiché sur toutes les fiches",
      "Accès aux analytics avancés",
      "Support prioritaire 24h/48h",
    ],
    durationDays: 60,
  },
  ARGENT: {
    price: 29000,
    currency: "FCFA",
    description: "Mise en avant ciblée pour booster vos ventes en phase finale.",
    advantages: [
      "Top 3 sur la homepage",
      "Section Événements à la une",
      "Inclusion dans la newsletter Feeti",
      "Badge ARGENT affiché sur les fiches",
      "Résultats de recherche mis en avant",
      "Analytics standard",
    ],
    durationDays: 60,
  },
  BRONZE: {
    price: 15000,
    currency: "FCFA",
    description: "Visibilité renforcée pour attirer plus d'acheteurs vers votre événement.",
    advantages: [
      "Section Événements à la une",
      "Position renforcée dans le listing",
      "Badge BRONZE affiché sur les fiches",
      "Analytics de base",
    ],
    durationDays: 45,
  },
  LITE: {
    price: 5000,
    currency: "FCFA",
    description: "Premier pas dans la mise en avant — idéal pour tester la visibilité.",
    advantages: [
      "Position renforcée dans le listing",
      "Badge LITE affiché sur les fiches",
    ],
    durationDays: 30,
  },
};

// Limites de slots simultanés
const SLOT_LIMITS: Record<string, number> = { OR: 2, ARGENT: 5, BRONZE: 10, LITE: 9999 };

/**
 * Initialise les configs manquantes en base (upsert silencieux).
 * Appelé au démarrage ou à la première requête.
 */
async function ensurePackConfigs() {
  for (const [type, defaults] of Object.entries(DEFAULT_PACK_CONFIGS)) {
    await prisma.promotionPackConfig.upsert({
      where: { type },
      create: {
        type,
        price: defaults.price,
        currency: defaults.currency,
        description: defaults.description,
        advantages: JSON.stringify(defaults.advantages),
        durationDays: defaults.durationDays,
      },
      update: {}, // ne pas écraser les valeurs déjà modifiées par l'admin
    });
  }
}

// ─── GET /api/promotion/pack-configs ─────────────────────────────────────────
// Public : retourne les configs de tous les packs + slots disponibles
export const getPackConfigs = controllerWrapper(async (_req: Request, res: Response) => {
  await ensurePackConfigs();

  const [configs, slotCounts] = await Promise.all([
    prisma.promotionPackConfig.findMany({ orderBy: { price: "desc" } }),
    prisma.event.groupBy({
      by: ["promotionType"],
      where: {
        promotionStatus: "active",
        promotionType: { not: null },
        OR: [{ promotionEndDate: null }, { promotionEndDate: { gte: new Date() } }],
      },
      _count: { id: true },
    }),
  ]);

  const result = configs.map(cfg => {
    const used = slotCounts.find(s => s.promotionType === cfg.type)?._count.id ?? 0;
    const limit = SLOT_LIMITS[cfg.type] ?? 0;
    return {
      ...cfg,
      advantages: JSON.parse(cfg.advantages) as string[],
      slots: { used, limit, available: Math.max(0, limit - used) },
    };
  });

  res.json(jsonResponse({ status: "success", message: "Configs packs récupérées", data: result }));
});

// ─── GET /api/promotion/slots/:type/next-release ──────────────────────────────
// Retourne la date de prochaine libération de slot pour un type de pack
export const getNextSlotRelease = controllerWrapper(async (req: Request, res: Response) => {
  const type = String(req.params.type).toUpperCase();
  const validTypes = ["OR", "ARGENT", "BRONZE", "LITE"];
  if (!validTypes.includes(type)) {
    throw new AppError("Type de pack invalide", StatusCodes.BAD_REQUEST);
  }

  const now = new Date();
  const limit = SLOT_LIMITS[type];

  // Compter les slots actifs
  const activeCount = await prisma.event.count({
    where: {
      promotionType: type,
      promotionStatus: "active",
      OR: [{ promotionEndDate: null }, { promotionEndDate: { gte: now } }],
    },
  });

  if (activeCount < limit) {
    return res.json(jsonResponse({
      status: "success",
      message: "Slots disponibles",
      data: { slotsFull: false, nextRelease: null, daysUntilRelease: 0 },
    }));
  }

  // Trouver la date d'expiration la plus proche parmi les slots actifs
  const earliest = await prisma.event.findFirst({
    where: {
      promotionType: type,
      promotionStatus: "active",
      promotionEndDate: { gte: now },
    },
    orderBy: { promotionEndDate: "asc" },
    select: { promotionEndDate: true },
  });

  const nextRelease = earliest?.promotionEndDate ?? null;
  const daysUntilRelease = nextRelease
    ? Math.ceil((nextRelease.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  res.json(jsonResponse({
    status: "success",
    message: "Prochain slot disponible",
    data: { slotsFull: true, nextRelease, daysUntilRelease },
  }));
});

// ─── POST /api/events/:id/promote ────────────────────────────────────────────
// Organisateur self-service : achète un pack promotionnel pour son événement
export const purchaseEventPromotion = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = String(req.params.id);
  const organizerId = req.user!.userId;
  const { packType } = req.body as { packType: string };

  const validTypes = ["OR", "ARGENT", "BRONZE", "LITE"];
  if (!validTypes.includes(packType)) {
    throw new AppError("Type de pack invalide (OR | ARGENT | BRONZE | LITE)", StatusCodes.BAD_REQUEST);
  }

  // Vérifier ownership
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
  if (event.organizerId !== organizerId) {
    throw new AppError("Vous n'êtes pas le propriétaire de cet événement", StatusCodes.FORBIDDEN);
  }
  if (event.status !== "published") {
    throw new AppError("L'événement doit être publié pour être mis en avant", StatusCodes.BAD_REQUEST);
  }
  if (event.promotionStatus === "active") {
    throw new AppError("Cet événement a déjà un pack actif", StatusCodes.CONFLICT);
  }

  // Vérifier les slots
  const now = new Date();
  const limit = SLOT_LIMITS[packType];
  const activeCount = await prisma.event.count({
    where: {
      id: { not: eventId },
      promotionType: packType,
      promotionStatus: "active",
      OR: [{ promotionEndDate: null }, { promotionEndDate: { gte: now } }],
    },
  });

  if (activeCount >= limit) {
    const earliest = await prisma.event.findFirst({
      where: {
        promotionType: packType,
        promotionStatus: "active",
        promotionEndDate: { gte: now },
      },
      orderBy: { promotionEndDate: "asc" },
      select: { promotionEndDate: true },
    });
    const daysUntil = earliest?.promotionEndDate
      ? Math.ceil((earliest.promotionEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    throw new AppError(
      `Slots Pack ${packType} complets. Prochain disponible dans ${daysUntil ?? '?'} jour(s).`,
      StatusCodes.CONFLICT
    );
  }

  // Récupérer la config du pack (avec fallback sur les defaults)
  await ensurePackConfigs();
  const cfg = await prisma.promotionPackConfig.findUnique({ where: { type: packType } });
  if (!cfg) throw new AppError("Configuration du pack introuvable", StatusCodes.INTERNAL_SERVER_ERROR);

  // Calculer les dates
  const startDate = now;
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + cfg.durationDays);

  // Transaction : créer le PromotionPurchase + mettre à jour l'Event
  const [purchase] = await prisma.$transaction([
    prisma.promotionPurchase.create({
      data: {
        eventId,
        organizerId,
        packType,
        pricePaid: cfg.price,
        currency: cfg.currency,
        status: "completed",
        paymentSimulated: true,
        promotionStartDate: startDate,
        promotionEndDate: endDate,
      },
    }),
    prisma.event.update({
      where: { id: eventId },
      data: {
        promotionType: packType,
        promotionStatus: "active",
        promotionStartDate: startDate,
        promotionEndDate: endDate,
      },
    }),
  ]);

  res.status(StatusCodes.CREATED).json(jsonResponse({
    status: "success",
    message: `Pack ${packType} activé avec succès`,
    data: {
      purchaseId: purchase.id,
      packType,
      pricePaid: cfg.price,
      currency: cfg.currency,
      promotionStartDate: startDate,
      promotionEndDate: endDate,
      durationDays: cfg.durationDays,
    },
  }));
});

// ─── GET /api/organizer/promotions ───────────────────────────────────────────
// Historique des promotions de l'organisateur connecté
export const getMyPromotions = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;

  const purchases = await prisma.promotionPurchase.findMany({
    where: { organizerId },
    include: {
      event: { select: { id: true, title: true, status: true, promotionStatus: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(jsonResponse({ status: "success", message: "Historique récupéré", data: purchases }));
});
