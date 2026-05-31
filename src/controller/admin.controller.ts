import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/database.js";
import { AppError } from "../utils/AppError.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import type { Role } from "../generated/prisma/client.js";
import { eventRepository } from "../repositories/event.repository.js";
import { emailService } from "../services/email.service.js";
import { feetiPlaySyncService } from "../services/feetiPlaySync.service.js";

// GET /api/admin/countries — returns ALL countries (including inactive)
export const getAllCountriesAdmin = controllerWrapper(async (_req: Request, res: Response) => {
  const countries = await prisma.country.findMany({ orderBy: { name: "asc" } });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Pays récupérés", data: countries }));
});

// GET /api/admin/tickets/stats
export const getTicketsStats = controllerWrapper(async (_req: Request, res: Response) => {
  const [totalSold, totalUsed, totalRefunded] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.count({ where: { usedAt: { not: null } } }),
    prisma.ticket.count({ where: { status: "refunded" } }),
  ]);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Statistiques billets", data: { totalSold, totalUsed, totalRefunded } })
  );
});

// GET /api/admin/tickets
export const getAdminTickets = controllerWrapper(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 100);
  const tickets = await prisma.ticket.findMany({
    include: {
      event: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Billets récupérés", data: tickets })
  );
});

// GET /api/admin/users
export const getAllUsers = controllerWrapper(async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { events: true, tickets: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Utilisateurs récupérés", data: users }));
});

// PATCH /api/admin/users/:id/role
export const updateUserRole = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { role } = req.body as { role: string };
  const validRoles = ["user", "organizer", "moderator", "admin", "super_admin"];
  if (!validRoles.includes(role)) {
    throw new AppError("Rôle invalide", StatusCodes.BAD_REQUEST);
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError("Utilisateur introuvable", StatusCodes.NOT_FOUND);

  // Prevent demoting other super_admins unless you are super_admin
  const actorRole = req.user!.role;
  if (user.role === "super_admin" && actorRole !== "super_admin") {
    throw new AppError("Impossible de modifier un super administrateur", StatusCodes.FORBIDDEN);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: role as Role },
    select: { id: true, name: true, email: true, role: true },
  });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Rôle mis à jour", data: updated }));
});

// DELETE /api/admin/users/:id
export const deleteUser = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const actorId = req.user!.userId;
  if (id === actorId) throw new AppError("Vous ne pouvez pas supprimer votre propre compte via l'admin", StatusCodes.BAD_REQUEST);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError("Utilisateur introuvable", StatusCodes.NOT_FOUND);

  if (user.role === "super_admin") throw new AppError("Impossible de supprimer un super administrateur", StatusCodes.FORBIDDEN);

  // Delete related data first
  await prisma.ticket.deleteMany({ where: { userId: id } });
  await prisma.ticket.deleteMany({ where: { event: { organizerId: id } } });
  await prisma.event.deleteMany({ where: { organizerId: id } });
  await prisma.user.delete({ where: { id } });

  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Utilisateur supprimé" }));
});

// GET /api/admin/events
export const getAllAdminEvents = controllerWrapper(async (_req: Request, res: Response) => {
  const events = await eventRepository.findAllAdmin();
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Événements récupérés", data: events }));
});

// PATCH /api/admin/events/:id/status
export const updateEventStatus = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status, rejectionReason } = req.body as { status: string; rejectionReason?: string };
  const validStatuses = ["draft", "published", "cancelled", "rejected"];
  if (!validStatuses.includes(status)) {
    throw new AppError("Statut invalide", StatusCodes.BAD_REQUEST);
  }
  if (status === "rejected" && !rejectionReason?.trim()) {
    throw new AppError("La raison du rejet est obligatoire", StatusCodes.BAD_REQUEST);
  }

  const event = await prisma.event.findUnique({
    where: { id },
    include: { organizer: { select: { email: true, name: true } } },
  });
  if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);

  const updated = await prisma.event.update({
    where: { id },
    data: {
      status,
      rejectionReason: status === "rejected" ? rejectionReason!.trim() : null,
    },
  });

  const dashboardUrl = `${process.env.FRONTEND_URL || "https://feeti.cg"}/organizer`;

  const isFeetiPlayEvent = event.eventType === "STREAMING_LIVE" || event.eventType === "MIXTE";

  if (status === "published") {
    emailService.sendEventApproved(event.organizer.email, {
      organizerName: event.organizer.name,
      eventTitle: event.title,
      eventDate: event.date,
      dashboardUrl,
    }).catch(() => {});
  } else if (status === "rejected") {
    emailService.sendEventRejected(event.organizer.email, {
      organizerName: event.organizer.name,
      eventTitle: event.title,
      rejectionReason: rejectionReason!.trim(),
      dashboardUrl,
    }).catch(() => {});

    // Supprimer le miroir FeetiPlay si l'événement est rejeté
    if (isFeetiPlayEvent) {
      feetiPlaySyncService.deleteLiveEvent(`feeti2_live_${event.id}`).catch(() => {});
    }
  }

  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Statut mis à jour", data: updated }));
});

// PATCH /api/admin/events/:id/promotion
// Attribue ou retire un pack promotionnel (OR / ARGENT / BRONZE / LITE) à un événement
export const updateEventPromotion = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { promotionType, promotionStatus, promotionStartDate, promotionEndDate } =
    req.body as {
      promotionType?: string | null;
      promotionStatus?: string;
      promotionStartDate?: string | null;
      promotionEndDate?: string | null;
    };

  const validTypes = ["OR", "ARGENT", "BRONZE", "LITE"];
  if (promotionType && !validTypes.includes(promotionType)) {
    throw new AppError("Type de promotion invalide (OR | ARGENT | BRONZE | LITE)", StatusCodes.BAD_REQUEST);
  }

  // Valider la durée selon le type de pack (PDF spec)
  // OR : ≤ 60j | ARGENT : 45–60j | BRONZE : 30–45j | LITE : 15–30j
  if (promotionType && promotionStartDate && promotionEndDate && promotionStatus === "active") {
    const DURATION_RULES: Record<string, { min: number; max: number }> = {
      OR:     { min: 1,  max: 60 },
      ARGENT: { min: 45, max: 60 },
      BRONZE: { min: 30, max: 45 },
      LITE:   { min: 15, max: 30 },
    };
    const rule = DURATION_RULES[promotionType];
    if (rule) {
      const start = new Date(promotionStartDate);
      const end = new Date(promotionEndDate);
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (days < rule.min || days > rule.max) {
        throw new AppError(
          `Durée invalide pour Pack ${promotionType} : ${rule.min}–${rule.max} jours requis (${days} jours saisis)`,
          StatusCodes.BAD_REQUEST
        );
      }
    }
  }

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);

  // Vérifier les limites de slots simultanés
  if (promotionType && promotionStatus === "active") {
    const LIMITS: Record<string, number> = { OR: 2, ARGENT: 5, BRONZE: 10, LITE: Infinity };
    const now = new Date();
    const activeCount = await prisma.event.count({
      where: {
        id: { not: id },
        promotionType,
        promotionStatus: "active",
        OR: [
          { promotionEndDate: null },
          { promotionEndDate: { gte: now } },
        ],
      },
    });
    const typeLimit = LIMITS[promotionType] ?? 0;
    if (activeCount >= typeLimit) {
      throw new AppError(
        `Limite atteinte : maximum ${typeLimit} événements Pack ${promotionType} simultanément`,
        StatusCodes.CONFLICT
      );
    }
  }

  const updated = await prisma.event.update({
    where: { id },
    data: {
      promotionType: promotionType ?? null,
      promotionStatus: promotionStatus ?? "inactive",
      promotionStartDate: promotionStartDate ? new Date(promotionStartDate) : null,
      promotionEndDate: promotionEndDate ? new Date(promotionEndDate) : null,
    },
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Promotion mise à jour", data: updated })
  );
});

// GET /api/admin/events/promotion-slots
// Retourne les slots disponibles par type de pack
export const getPromotionSlots = controllerWrapper(async (_req: Request, res: Response) => {
  const LIMITS: Record<string, number> = { OR: 2, ARGENT: 5, BRONZE: 10, LITE: 9999 };
  const now = new Date();

  const counts = await prisma.event.groupBy({
    by: ["promotionType"],
    where: {
      promotionStatus: "active",
      promotionType: { not: null },
      OR: [{ promotionEndDate: null }, { promotionEndDate: { gte: now } }],
    },
    _count: { id: true },
  });

  const result = Object.entries(LIMITS).map(([type, limit]) => {
    const used = counts.find(c => c.promotionType === type)?._count.id ?? 0;
    return { type, limit, used, available: Math.max(0, limit - used) };
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Slots récupérés", data: result })
  );
});

// GET /api/admin/leisure/promotion-slots
// Retourne les slots disponibles par type de pack loisir
export const getLeisurePromotionSlots = controllerWrapper(async (_req: Request, res: Response) => {
  const LEISURE_PACK_LIMITS: Record<string, number> = {
    CAMPAGNE_PREMIUM: 3,
    BOOST: 5,
    VISIBILITE_ACCUEIL: 10,
  };
  const now = new Date();

  const counts = await prisma.leisureItem.groupBy({
    by: ["leisurePackType"],
    where: {
      leisurePackStatus: "active",
      leisurePackType: { not: null },
      OR: [{ leisurePackEndDate: null }, { leisurePackEndDate: { gte: now } }],
    },
    _count: { id: true },
  });

  const result = Object.entries(LEISURE_PACK_LIMITS).map(([type, limit]) => {
    const used = counts.find(c => c.leisurePackType === type)?._count.id ?? 0;
    return { type, limit, used, available: Math.max(0, limit - used) };
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Slots loisirs récupérés", data: result })
  );
});

// ─── Promotions Bon Plans (admin-géré) ───────────────────────────────────────

// GET /api/admin/deal-promotion-slots
export const getDealPromotionSlots = controllerWrapper(async (_req: Request, res: Response) => {
  const LIMITS: Record<string, number> = { OR: 2, ARGENT: 5, BRONZE: 10, LITE: 9999 };
  const now = new Date();

  const counts = await prisma.deal.groupBy({
    by: ["promotionType"],
    where: {
      promotionStatus: "active",
      promotionType: { not: null },
      OR: [{ promotionEndDate: null }, { promotionEndDate: { gte: now } }],
    },
    _count: { id: true },
  });

  const result = Object.entries(LIMITS).map(([type, limit]) => {
    const used = counts.find(c => c.promotionType === type)?._count.id ?? 0;
    return { type, limit, used, available: Math.max(0, limit - used) };
  });

  res.json(jsonResponse({ status: "success", message: "Slots deals récupérés", data: result }));
});

// PATCH /api/admin/deals/:id/promotion
export const updateDealPromotion = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { promotionType, promotionStatus, promotionStartDate, promotionEndDate } = req.body as {
    promotionType?: string | null;
    promotionStatus?: string;
    promotionStartDate?: string | null;
    promotionEndDate?: string | null;
  };

  const validTypes = ["OR", "ARGENT", "BRONZE", "LITE"];
  if (promotionType && !validTypes.includes(promotionType)) {
    throw new AppError("Type de promotion invalide", StatusCodes.BAD_REQUEST);
  }

  const deal = await prisma.deal.findUnique({ where: { id } });
  if (!deal) throw new AppError("Bon plan introuvable", StatusCodes.NOT_FOUND);

  // Vérifier les slots si activation
  if (promotionType && promotionStatus === "active") {
    const LIMITS: Record<string, number> = { OR: 2, ARGENT: 5, BRONZE: 10, LITE: Infinity };
    const now = new Date();
    const activeCount = await prisma.deal.count({
      where: {
        id: { not: id },
        promotionType,
        promotionStatus: "active",
        OR: [{ promotionEndDate: null }, { promotionEndDate: { gte: now } }],
      },
    });
    if (activeCount >= (LIMITS[promotionType] ?? 0)) {
      throw new AppError(`Limite atteinte : max ${LIMITS[promotionType]} deals Pack ${promotionType} simultanément`, StatusCodes.CONFLICT);
    }
  }

  const updated = await prisma.deal.update({
    where: { id },
    data: {
      promotionType: promotionType ?? null,
      promotionStatus: promotionStatus ?? "inactive",
      promotionStartDate: promotionStartDate ? new Date(promotionStartDate) : null,
      promotionEndDate: promotionEndDate ? new Date(promotionEndDate) : null,
    },
  });

  res.json(jsonResponse({ status: "success", message: "Promotion deal mise à jour", data: updated }));
});

// ─── Suivi & config packs promotion ──────────────────────────────────────────

// GET /api/admin/promotions
// Liste toutes les promotions achetées (avec filtres)
export const getAdminPromotions = controllerWrapper(async (req: Request, res: Response) => {
  const { packType, status, dateFrom, dateTo, page = "1", limit = "30" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = {};
  if (packType) where.packType = packType;
  if (status) where.status = status;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const [purchases, total] = await Promise.all([
    prisma.promotionPurchase.findMany({
      where,
      include: {
        event: { select: { id: true, title: true, status: true, promotionStatus: true, promotionEndDate: true } },
        organizer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: parseInt(limit),
    }),
    prisma.promotionPurchase.count({ where }),
  ]);

  res.json({
    ...jsonResponse({ status: "success", message: "Promotions récupérées", data: purchases }),
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
});

// GET /api/admin/promotions/stats
// Statistiques globales des promotions
export const getAdminPromotionStats = controllerWrapper(async (_req: Request, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [byPack, activePurchases, totalRevenue, monthRevenue] = await Promise.all([
    prisma.promotionPurchase.groupBy({
      by: ["packType"],
      where: { status: "completed" },
      _count: { id: true },
      _sum: { pricePaid: true },
    }),
    prisma.promotionPurchase.count({
      where: {
        status: "completed",
        promotionEndDate: { gte: now },
      },
    }),
    prisma.promotionPurchase.aggregate({
      where: { status: "completed" },
      _sum: { pricePaid: true },
    }),
    prisma.promotionPurchase.aggregate({
      where: { status: "completed", createdAt: { gte: startOfMonth } },
      _sum: { pricePaid: true },
    }),
  ]);

  res.json(jsonResponse({
    status: "success",
    message: "Stats promotions",
    data: {
      totalRevenue: totalRevenue._sum.pricePaid ?? 0,
      monthRevenue: monthRevenue._sum.pricePaid ?? 0,
      activePurchases,
      byPack: byPack.map(b => ({
        packType: b.packType,
        count: b._count.id,
        revenue: b._sum.pricePaid ?? 0,
      })),
    },
  }));
});

// PATCH /api/admin/promotions/:id/deactivate
// Désactivation manuelle d'une promotion par l'admin
export const deactivatePromotion = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const adminId = req.user!.userId;
  const { notes } = req.body as { notes?: string };

  const purchase = await prisma.promotionPurchase.findUnique({
    where: { id },
    include: { event: { select: { id: true } } },
  });
  if (!purchase) throw new AppError("Achat introuvable", StatusCodes.NOT_FOUND);

  await prisma.$transaction([
    prisma.promotionPurchase.update({
      where: { id },
      data: { status: "cancelled", deactivatedAt: new Date(), deactivatedBy: adminId, notes },
    }),
    prisma.event.update({
      where: { id: purchase.eventId },
      data: { promotionStatus: "inactive", promotionType: null, promotionStartDate: null, promotionEndDate: null },
    }),
  ]);

  res.json(jsonResponse({ status: "success", message: "Promotion désactivée" }));
});

// GET /api/admin/promotion-pack-configs
export const getAdminPackConfigs = controllerWrapper(async (_req: Request, res: Response) => {
  const configs = await prisma.promotionPackConfig.findMany({ orderBy: { price: "desc" } });
  const parsed = configs.map(c => ({ ...c, advantages: JSON.parse(c.advantages) as string[] }));
  res.json(jsonResponse({ status: "success", message: "Configs récupérées", data: parsed }));
});

// PUT /api/admin/promotion-pack-configs/:type
// Mise à jour d'une config de pack (prix, description, avantages, durée)
export const updatePackConfig = controllerWrapper(async (req: Request, res: Response) => {
  const type = String(req.params.type).toUpperCase();
  const validTypes = ["OR", "ARGENT", "BRONZE", "LITE"];
  if (!validTypes.includes(type)) {
    throw new AppError("Type de pack invalide", StatusCodes.BAD_REQUEST);
  }

  const { price, description, advantages, durationDays } = req.body as {
    price?: number; description?: string; advantages?: string[]; durationDays?: number;
  };

  const updated = await prisma.promotionPackConfig.upsert({
    where: { type },
    create: {
      type,
      price: price ?? 0,
      description: description ?? "",
      advantages: JSON.stringify(advantages ?? []),
      durationDays: durationDays ?? 30,
      updatedBy: req.user!.userId,
    },
    update: {
      ...(price !== undefined && { price }),
      ...(description !== undefined && { description }),
      ...(advantages !== undefined && { advantages: JSON.stringify(advantages) }),
      ...(durationDays !== undefined && { durationDays }),
      updatedBy: req.user!.userId,
    },
  });

  res.json(jsonResponse({
    status: "success",
    message: "Config mise à jour",
    data: { ...updated, advantages: JSON.parse(updated.advantages) as string[] },
  }));
});

// PATCH /api/admin/leisure/:id/promotion
// Attribue une offre annuaire et/ou un pack ponctuel à un établissement loisir
export const updateLeisurePromotion = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const {
    leisureOfferType,
    leisurePackType,
    leisurePackStatus,
    leisurePackStartDate,
    leisurePackEndDate,
  } = req.body as {
    leisureOfferType?: string | null;
    leisurePackType?: string | null;
    leisurePackStatus?: string;
    leisurePackStartDate?: string | null;
    leisurePackEndDate?: string | null;
  };

  const validOffers = ["BASIC", "PRO", "PREMIUM"];
  const validPacks = ["VISIBILITE_ACCUEIL", "BOOST", "CAMPAGNE_PREMIUM"];

  if (leisureOfferType && !validOffers.includes(leisureOfferType)) {
    throw new AppError("Offre invalide (BASIC | PRO | PREMIUM)", StatusCodes.BAD_REQUEST);
  }
  if (leisurePackType && !validPacks.includes(leisurePackType)) {
    throw new AppError("Pack invalide (VISIBILITE_ACCUEIL | BOOST | CAMPAGNE_PREMIUM)", StatusCodes.BAD_REQUEST);
  }

  // Valider la durée : tous les packs ponctuels sont sur 7 jours (PDF spec)
  if (leisurePackType && leisurePackStartDate && leisurePackEndDate && leisurePackStatus === "active") {
    const start = new Date(leisurePackStartDate);
    const end = new Date(leisurePackEndDate);
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (days !== 7) {
      throw new AppError(
        `Durée invalide pour Pack ${leisurePackType} : exactement 7 jours requis (${days} jours saisis)`,
        StatusCodes.BAD_REQUEST
      );
    }
  }

  // Vérifier les limites de slots simultanés pour les packs loisirs
  if (leisurePackType && leisurePackStatus === "active") {
    const LEISURE_PACK_LIMITS: Record<string, number> = {
      CAMPAGNE_PREMIUM: 3,
      BOOST: 5,
      VISIBILITE_ACCUEIL: 10,
    };
    const now = new Date();
    const activeCount = await prisma.leisureItem.count({
      where: {
        id: { not: id },
        leisurePackType,
        leisurePackStatus: "active",
        OR: [
          { leisurePackEndDate: null },
          { leisurePackEndDate: { gte: now } },
        ],
      },
    });
    const packLimit = LEISURE_PACK_LIMITS[leisurePackType] ?? 0;
    if (activeCount >= packLimit) {
      throw new AppError(
        `Limite atteinte : maximum ${packLimit} établissements Pack ${leisurePackType} simultanément`,
        StatusCodes.CONFLICT
      );
    }
  }

  const item = await prisma.leisureItem.findUnique({ where: { id } });
  if (!item) throw new AppError("Établissement introuvable", StatusCodes.NOT_FOUND);

  const updated = await prisma.leisureItem.update({
    where: { id },
    data: {
      leisureOfferType: leisureOfferType ?? null,
      leisurePackType: leisurePackType ?? null,
      leisurePackStatus: leisurePackStatus ?? "inactive",
      leisurePackStartDate: leisurePackStartDate ? new Date(leisurePackStartDate) : null,
      leisurePackEndDate: leisurePackEndDate ? new Date(leisurePackEndDate) : null,
    },
    include: { category: true },
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Promotion loisir mise à jour", data: updated })
  );
});
