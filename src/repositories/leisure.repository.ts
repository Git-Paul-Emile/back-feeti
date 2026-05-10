import { prisma } from '../config/database.js';

export interface LeisureFilters {
  categorySlug?: string;
  countryCode?: string;
  search?: string;
  status?: string;
  lat?: number;
  lng?: number;
}

// Formule de Haversine — retourne la distance en km entre deux coordonnées GPS
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface LeisureItemCreateInput {
  name: string;
  description: string;
  categorySlug: string;
  location: string;
  address?: string;
  phone?: string;
  website?: string;
  priceRange?: string;
  openingHours?: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
  features?: string;
  tags?: string;
  status?: string;
  countryCode?: string;
  isFeatured?: boolean;
  createdById: string;
}

const leisureRepository = {
  async findAll(filters: LeisureFilters = {}) {
    const { categorySlug, countryCode, search, status = 'published', lat, lng } = filters;

    const where: Record<string, unknown> = { status };
    if (categorySlug && categorySlug !== 'all') where.categorySlug = categorySlug;
    if (countryCode) where.countryCode = countryCode;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.leisureItem.findMany({
      where,
      include: { category: true },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });

    const now = new Date();

    // Rang abonnement annuaire : PREMIUM=3, PRO=2, BASIC=1, aucun=0
    const OFFER_RANK: Record<string, number> = { PREMIUM: 3, PRO: 2, BASIC: 1 };
    // Rang pack ponctuel actif : CAMPAGNE_PREMIUM=3, BOOST=2, VISIBILITE_ACCUEIL=1
    const PACK_RANK: Record<string, number> = { CAMPAGNE_PREMIUM: 3, BOOST: 2, VISIBILITE_ACCUEIL: 1 };

    const withRank = items.map(item => {
      const packActive =
        item.leisurePackStatus === 'active' &&
        item.leisurePackType &&
        (!item.leisurePackStartDate || item.leisurePackStartDate <= now) &&
        (!item.leisurePackEndDate || item.leisurePackEndDate >= now);
      const packRank = packActive ? (PACK_RANK[item.leisurePackType!] ?? 0) : 0;
      const offerRank = OFFER_RANK[item.leisureOfferType ?? ''] ?? 0;
      return { ...item, _sortRank: packRank * 10 + offerRank };
    });

    // Si les coordonnées GPS sont fournies, trier par proximité d'abord
    if (lat !== undefined && lng !== undefined) {
      return withRank
        .sort((a, b) => {
          const distA = (a.latitude != null && a.longitude != null)
            ? haversineDistance(lat, lng, a.latitude, a.longitude)
            : Infinity;
          const distB = (b.latitude != null && b.longitude != null)
            ? haversineDistance(lat, lng, b.latitude, b.longitude)
            : Infinity;
          // Priorité promo d'abord, puis proximité
          if (b._sortRank !== a._sortRank) return b._sortRank - a._sortRank;
          return distA - distB;
        })
        .map(({ _sortRank, ...item }) => item);
    }

    return withRank
      .sort((a, b) => b._sortRank - a._sortRank)
      .map(({ _sortRank, ...item }) => item);
  },

  async findAllAdmin() {
    return prisma.leisureItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async findById(id: string) {
    return prisma.leisureItem.findUnique({
      where: { id },
      include: { category: true },
    });
  },

  async create(data: LeisureItemCreateInput) {
    return prisma.leisureItem.create({ data, include: { category: true } });
  },

  async update(id: string, data: Partial<Omit<LeisureItemCreateInput, 'createdById'> & {
    leisureOfferType: string | null;
    leisurePackType: string | null;
    leisurePackStatus: string | null;
    leisurePackStartDate: Date | null;
    leisurePackEndDate: Date | null;
  }>) {
    return prisma.leisureItem.update({ where: { id }, data, include: { category: true } });
  },

  async delete(id: string) {
    return prisma.leisureItem.delete({ where: { id } });
  },

  async toggleFavorite(userId: string, leisureItemId: string) {
    const existing = await prisma.leisureFavorite.findUnique({
      where: { userId_leisureItemId: { userId, leisureItemId } },
    });
    if (existing) {
      await prisma.leisureFavorite.delete({ where: { id: existing.id } });
      return { isFavorited: false };
    }
    await prisma.leisureFavorite.create({ data: { userId, leisureItemId } });
    return { isFavorited: true };
  },

  async isFavorited(userId: string, leisureItemId: string) {
    const fav = await prisma.leisureFavorite.findUnique({
      where: { userId_leisureItemId: { userId, leisureItemId } },
    });
    return !!fav;
  },

  async getMyFavorites(userId: string) {
    const favs = await prisma.leisureFavorite.findMany({
      where: { userId },
      include: { leisureItem: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return favs.map(f => f.leisureItem);
  },
};

export { leisureRepository };
