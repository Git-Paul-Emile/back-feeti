import { prisma } from "../config/database.js";

export const eventRepository = {
  async create(data: {
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
    status?: string;
    organizerId: string;
    isPrivateForBadges?: boolean;
    salesBlocked?: boolean;
  }) {
    return prisma.event.create({ data });
  },

  async findByOrganizer(organizerId: string) {
    const events = await prisma.event.findMany({
      where: { organizerId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            tickets: { where: { status: { notIn: ["refunded", "expired"] } } },
          },
        },
        transactions: {
          where: { status: { in: ["completed", "paid"] } },
          select: { netOrganisateur: true },
        },
      },
    });
    return events.map(({ _count, transactions, ...e }) => ({
      ...e,
      attendees: _count.tickets,
      // netOrganisateur est stocké en centimes → convertir en FCFA (÷100)
      totalRevenue: Math.round(transactions.reduce((sum, t) => sum + t.netOrganisateur, 0) / 100),
    }));
  },

  async findAll(countryCode?: string, interests?: string[]) {
    const now = new Date();

    const events = await prisma.event.findMany({
      where: {
        status: "published",
        isPrivateForBadges: false,
        ...(countryCode ? { countryCode } : {}),
      },
      include: { organizer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Priorité promotion : OR=4, ARGENT=3, BRONZE=2, LITE=1, aucun=0
    const PROMO_RANK: Record<string, number> = { OR: 4, ARGENT: 3, BRONZE: 2, LITE: 1 };

    const withRank = events.map(e => {
      const isActive =
        e.promotionStatus === "active" &&
        e.promotionType &&
        (!e.promotionStartDate || e.promotionStartDate <= now) &&
        (!e.promotionEndDate || e.promotionEndDate >= now);
      return { ...e, _promoRank: isActive ? (PROMO_RANK[e.promotionType!] ?? 0) : 0 };
    });

    // Trier : d'abord par rang promotion desc
    withRank.sort((a, b) => b._promoRank - a._promoRank);

    // Si l'utilisateur a des intérêts, mettre en avant les événements correspondants
    // (uniquement parmi les non-promus)
    if (interests && interests.length > 0) {
      const promoted = withRank.filter(e => e._promoRank > 0);
      const rest = withRank.filter(e => e._promoRank === 0);
      const matching = rest.filter(e => interests.includes(e.category));
      const others = rest.filter(e => !interests.includes(e.category));
      // Supprimer le champ de tri interne avant le retour
      return [...promoted, ...matching, ...others].map(({ _promoRank, ...e }) => e);
    }

    return withRank.map(({ _promoRank, ...e }) => e);
  },

  async findAllAdmin() {
    const events = await prisma.event.findMany({
      include: { organizer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    // Pending (draft) events first, then others
    const statusOrder: Record<string, number> = { draft: 0, published: 1, cancelled: 2, rejected: 3 };
    return events.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
  },

  async findById(id: string) {
    return prisma.event.findUnique({
      where: { id },
      include: { organizer: { select: { name: true } } },
    });
  },

  async update(id: string, data: Partial<{
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
    salesBlocked: boolean;
    attendees: number;
    isLive: boolean;
    isFavorite: boolean;
    status: string;
    streamUrl: string;
    videoUrl: string;
    countryCode: string | null;
    promotionType: string | null;
    promotionStatus: string | null;
    promotionStartDate: Date | null;
    promotionEndDate: Date | null;
  }>) {
    return prisma.event.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.event.delete({ where: { id } });
  },

  // ── Favoris ──────────────────────────────────────────────────────────────

  async isFavorited(userId: string, eventId: string): Promise<boolean> {
    const fav = await prisma.userFavorite.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    return fav !== null;
  },

  async toggleFavorite(userId: string, eventId: string): Promise<boolean> {
    const existing = await prisma.userFavorite.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (existing) {
      await prisma.userFavorite.delete({ where: { id: existing.id } });
      return false;
    } else {
      await prisma.userFavorite.create({ data: { userId, eventId } });
      return true;
    }
  },

  async findFavoritesByUser(userId: string) {
    const favs = await prisma.userFavorite.findMany({
      where: { userId },
      include: {
        event: {
          include: { organizer: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return favs.map(f => f.event);
  },
};
