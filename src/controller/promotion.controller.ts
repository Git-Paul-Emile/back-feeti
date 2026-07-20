/**
 * promotion.controller.ts
 * Gestion self-service des promotions par les organisateurs
 */
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Prisma } from "../generated/prisma/client.js";
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
// Body: { packType, paymentMode: "immediate"|"on_sales", paymentProvider?, paymentRef?, paymentSimulated? }
export const purchaseEventPromotion = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = String(req.params.id);
  const organizerId = req.user!.userId;
  const {
    packType,
    paymentMode = "immediate",
    paymentProvider,
    paymentRef,
    paymentSimulated = false,
  } = req.body as {
    packType: string;
    paymentMode?: "immediate" | "on_sales";
    paymentProvider?: string;
    paymentRef?: string;
    paymentSimulated?: boolean;
  };

  const validTypes = ["OR", "ARGENT", "BRONZE", "LITE"];
  if (!validTypes.includes(packType)) {
    throw new AppError("Type de pack invalide (OR | ARGENT | BRONZE | LITE)", StatusCodes.BAD_REQUEST);
  }
  if (!["immediate", "on_sales"].includes(paymentMode)) {
    throw new AppError("paymentMode invalide (immediate | on_sales)", StatusCodes.BAD_REQUEST);
  }
  if (paymentMode === "immediate" && !paymentSimulated && !paymentRef) {
    throw new AppError("paymentRef requis pour un paiement immédiat", StatusCodes.BAD_REQUEST);
  }

  // Les événements feeti2_live_ existent dans Firestore, pas en PostgreSQL.
  // Pour les événements MIXTE, leur ID local est l'UUID sans le préfixe.
  const FEETIPLAY_PREFIX = "feeti2_live_";
  const isLiveAlias = eventId.startsWith(FEETIPLAY_PREFIX);
  const localEventId = isLiveAlias ? eventId.replace(FEETIPLAY_PREFIX, "") : eventId;

  const event = await prisma.event.findUnique({ where: { id: localEventId } });
  if (!event) {
    throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
  }
  if (event.organizerId !== organizerId) {
    throw new AppError("Vous n'êtes pas le propriétaire de cet événement", StatusCodes.FORBIDDEN);
  }
  if (event.status !== "published") {
    throw new AppError("L'événement doit être publié pour être mis en avant", StatusCodes.BAD_REQUEST);
  }
  if (event.promotionStatus === "active") {
    throw new AppError("Cet événement a déjà un pack actif", StatusCodes.CONFLICT);
  }

  // Récupérer la config du pack
  await ensurePackConfigs();
  const cfg = await prisma.promotionPackConfig.findUnique({ where: { type: packType } });
  if (!cfg) throw new AppError("Configuration du pack introuvable", StatusCodes.INTERNAL_SERVER_ERROR);

  // Calculer les dates
  const now = new Date();
  const limit = SLOT_LIMITS[packType];
  const startDate = now;
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + cfg.durationDays);

  // Déterminer le statut selon le mode de paiement
  const purchaseStatus = paymentMode === "on_sales" ? "pending_payment" : "completed";
  const paymentStatus  = paymentMode === "on_sales" ? "pending"          : "completed";

  // Revérifier les slots et créer le PromotionPurchase + activer l'Event de
  // façon atomique (isolation Serializable + retry sur conflit) : sans ça,
  // deux achats concurrents sur les mêmes slots peuvent tous les deux passer
  // le contrôle de quota.
  const MAX_ATTEMPTS = 3;
  let purchase;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      purchase = await prisma.$transaction(
        async (tx) => {
          const activeCount = await tx.event.count({
            where: {
              id: { not: localEventId },
              promotionType: packType,
              promotionStatus: "active",
              OR: [{ promotionEndDate: null }, { promotionEndDate: { gte: now } }],
            },
          });

          if (activeCount >= limit) {
            const earliest = await tx.event.findFirst({
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

          const created = await tx.promotionPurchase.create({
            data: {
              eventId: localEventId,
              organizerId,
              packType,
              pricePaid: cfg.price,
              currency: cfg.currency,
              status: purchaseStatus,
              paymentMode,
              paymentStatus,
              paymentProvider: paymentProvider ?? null,
              paymentSimulated,
              paymentRef: paymentRef ?? null,
              promotionStartDate: startDate,
              promotionEndDate: endDate,
            },
          });

          // Dans les deux cas l'événement est mis en avant immédiatement
          await tx.event.update({
            where: { id: localEventId },
            data: {
              promotionType: packType,
              promotionStatus: "active",
              promotionStartDate: startDate,
              promotionEndDate: endDate,
            },
          });

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      break;
    } catch (err) {
      const isSerializationConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isSerializationConflict && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }

  if (!purchase) throw new AppError("Échec de l'achat de la promotion", StatusCodes.INTERNAL_SERVER_ERROR);

  const modeLabel = paymentMode === "on_sales"
    ? "Pack activé — coût déduit automatiquement sur les ventes de billets"
    : `Pack ${packType} activé avec succès`;

  res.status(StatusCodes.CREATED).json(jsonResponse({
    status: "success",
    message: modeLabel,
    data: {
      purchaseId: purchase.id,
      packType,
      pricePaid: cfg.price,
      currency: cfg.currency,
      paymentMode,
      paymentStatus,
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
