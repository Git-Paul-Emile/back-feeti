import { prisma } from '../config/database.js';

export interface DealFilters {
  search?: string;
  category?: string;
  location?: string;
  discountRange?: 'low' | 'medium' | 'high';
  priceRange?: 'low' | 'medium' | 'high';
  sortBy?: 'popularity' | 'discount-high' | 'discount-low' | 'price-low' | 'price-high' | 'ending-soon' | 'name';
  countryCode?: string;
  leisureItemId?: string;
  page?: number;
  limit?: number;
}

export interface DealCreateInput {
  title: string;
  description: string;
  category: string;
  originalPrice: number;
  discountedPrice: number;
  discount: number;
  validUntil: string;
  location: string;
  image?: string;
  isPopular?: boolean;
  merchantName: string;
  tags?: string;
  availableQuantity?: number;
  maxQuantity?: number;
  rating?: number;
  reviewCount?: number;
  contactPhone?: string;
  contactEmail?: string;
  contactWebsite?: string;
  status?: string;
  countryCode?: string;
  leisureItemId?: string;
  createdById: string;
}

const leisureItemSelect = {
  id: true,
  name: true,
  image: true,
  address: true,
  location: true,
  phone: true,
  website: true,
} as const;

const dealRepository = {
  async findAll(filters: DealFilters = {}) {
    const { search, category, location, discountRange, priceRange, sortBy = 'popularity', countryCode, leisureItemId, page = 1, limit = 12 } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { status: 'published' };

    if (countryCode) where.countryCode = countryCode;
    if (category && category !== 'all') where.category = category;
    if (location && location !== 'all') where.location = location;
    if (leisureItemId) where.leisureItemId = leisureItemId;

    if (discountRange === 'low') {
      where.discount = { lte: 25 };
    } else if (discountRange === 'medium') {
      where.discount = { gt: 25, lte: 40 };
    } else if (discountRange === 'high') {
      where.discount = { gt: 40 };
    }

    if (priceRange === 'low') {
      where.discountedPrice = { lte: 20000 };
    } else if (priceRange === 'medium') {
      where.discountedPrice = { gt: 20000, lte: 50000 };
    } else if (priceRange === 'high') {
      where.discountedPrice = { gt: 50000 };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { merchantName: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy = buildOrderBy(sortBy);

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({ where, orderBy, skip, take: limit, include: { leisureItem: { select: leisureItemSelect } } }),
      prisma.deal.count({ where }),
    ]);

    return { deals, total };
  },

  async findAllAdmin() {
    return prisma.deal.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        leisureItem: { select: leisureItemSelect },
      },
    });
  },

  async findById(id: string) {
    return prisma.deal.findUnique({
      where: { id },
      include: { leisureItem: { select: leisureItemSelect } },
    });
  },

  async findByLeisureItemId(leisureItemId: string, onlyPublished = true) {
    const where: Record<string, unknown> = { leisureItemId };
    if (onlyPublished) where.status = 'published';
    return prisma.deal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { leisureItem: { select: leisureItemSelect } },
    });
  },

  async create(data: DealCreateInput) {
    return prisma.deal.create({
      data,
      include: { leisureItem: { select: leisureItemSelect } },
    });
  },

  async update(id: string, data: Partial<Omit<DealCreateInput, 'createdById'>>) {
    return prisma.deal.update({
      where: { id },
      data,
      include: { leisureItem: { select: leisureItemSelect } },
    });
  },

  async delete(id: string) {
    return prisma.deal.delete({ where: { id } });
  },

  async getDistinctLocations(countryCode?: string) {
    const where = countryCode ? { status: 'published', countryCode } : { status: 'published' };
    const results = await prisma.deal.findMany({
      where,
      select: { location: true },
      distinct: ['location'],
      orderBy: { location: 'asc' },
    });
    return results.map(r => r.location);
  },
};

function buildOrderBy(sortBy: string): Record<string, string> {
  switch (sortBy) {
    case 'popularity': return { rating: 'desc' };
    case 'discount-high': return { discount: 'desc' };
    case 'discount-low': return { discount: 'asc' };
    case 'price-low': return { discountedPrice: 'asc' };
    case 'price-high': return { discountedPrice: 'desc' };
    case 'ending-soon': return { validUntil: 'asc' };
    case 'name': return { title: 'asc' };
    default: return { createdAt: 'desc' };
  }
}

export { dealRepository };
