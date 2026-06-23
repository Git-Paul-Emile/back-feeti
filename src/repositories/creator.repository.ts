import { prisma } from "../config/database.js";

export interface CreatorProfileInput {
  userId: string;
  bio?: string;
  niche?: string;
  audienceSize?: number;
  engagementRate?: number;
  socialLinks?: Record<string, string>;
  portfolio?: string;
}

export interface CreatorCampaignInput {
  title: string;
  description: string;
  organizerId: string;
  budget: number;
  currency?: string;
  niche?: string;
  minAudience?: number;
  requirements?: string;
  deliverables?: string;
  startDate?: string;
  endDate: string;
  maxCreators?: number;
}

export interface CreatorApplicationInput {
  campaignId: string;
  creatorId: string;
  message?: string;
}

export interface CreatorCollaborationInput {
  campaignId: string;
  creatorId: string;
  organizerId: string;
  agreedFee: number;
  currency?: string;
  deliverables?: string;
}

const creatorRepository = {
  async getProfile(userId: string) {
    return prisma.creator.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } },
    });
  },

  async getProfileById(id: string) {
    return prisma.creator.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } },
    });
  },

  async createProfile(data: CreatorProfileInput) {
    return prisma.creator.create({
      data: {
        ...data,
        socialLinks: data.socialLinks ?? {},
      },
      include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } },
    });
  },

  async updateProfile(userId: string, data: Partial<CreatorProfileInput> & { isVerified?: boolean; isActive?: boolean; rating?: number; reviewCount?: number }) {
    return prisma.creator.update({
      where: { userId },
      data,
      include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } },
    });
  },

  async deleteProfile(userId: string) {
    return prisma.creator.delete({ where: { userId } });
  },

  async listActive(filters: { niche?: string; verified?: boolean; minAudience?: number } = {}) {
    const where: Record<string, unknown> = { isActive: true };
    if (filters.niche) where.niche = filters.niche;
    if (filters.verified !== undefined) where.isVerified = filters.verified;
    if (filters.minAudience) where.audienceSize = { gte: filters.minAudience };

    return prisma.creator.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } },
      orderBy: [{ rating: "desc" }, { collaborationCount: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
  },

  async getAllForAdmin(filters: { niche?: string; verified?: boolean } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.niche) where.niche = filters.niche;
    if (filters.verified !== undefined) where.isVerified = filters.verified;

    return prisma.creator.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  // ── Campaigns ──────────────────────────────────────────────────────────

  async createCampaign(data: CreatorCampaignInput) {
    return prisma.creatorCampaign.create({
      data: {
        title: data.title,
        description: data.description,
        organizerId: data.organizerId,
        budget: data.budget,
        currency: data.currency ?? "FCFA",
        niche: data.niche,
        minAudience: data.minAudience,
        requirements: data.requirements,
        deliverables: data.deliverables,
        startDate: data.startDate,
        endDate: data.endDate,
        maxCreators: data.maxCreators ?? 10,
      },
      include: { organizer: { select: { id: true, name: true, email: true } } },
    });
  },

  async getCampaignById(id: string) {
    return prisma.creatorCampaign.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        applications: { include: { creator: { include: { user: { select: { id: true, name: true, email: true } } } } } },
        collaborations: { include: { creator: { include: { user: { select: { id: true, name: true, email: true } } } } } },
      },
    });
  },

  async listOpenCampaigns(filters: { niche?: string } = {}) {
    const where: Record<string, unknown> = { status: "open" };
    if (filters.niche) where.niche = filters.niche;

    return prisma.creatorCampaign.findMany({
      where,
      include: { organizer: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async listMyCampaigns(organizerId: string) {
    return prisma.creatorCampaign.findMany({
      where: { organizerId },
      include: { organizer: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async updateCampaignStatus(id: string, status: string) {
    return prisma.creatorCampaign.update({
      where: { id },
      data: { status },
      include: { organizer: { select: { id: true, name: true } } },
    });
  },

  async deleteCampaign(id: string) {
    return prisma.creatorCampaign.delete({ where: { id } });
  },

  // ── Applications ───────────────────────────────────────────────────────

  async applyToCampaign(data: CreatorApplicationInput) {
    const existing = await prisma.creatorCampaignApplication.findUnique({
      where: { campaignId_creatorId: { campaignId: data.campaignId, creatorId: data.creatorId } },
    });
    if (existing) {
      return prisma.creatorCampaignApplication.update({
        where: { campaignId_creatorId: { campaignId: data.campaignId, creatorId: data.creatorId } },
        data: {
          message: data.message ?? existing.message,
          status: "pending",
          reviewedAt: null,
        },
      });
    }
    return prisma.creatorCampaignApplication.create({
      data: {
        campaignId: data.campaignId,
        creatorId: data.creatorId,
        message: data.message,
      },
      include: { campaign: { select: { id: true, title: true } }, creator: { include: { user: { select: { id: true, name: true } } } } },
    });
  },

  async getApplicationsForCampaign(campaignId: string) {
    return prisma.creatorCampaignApplication.findMany({
      where: { campaignId },
      include: { creator: { include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } } } },
      orderBy: { createdAt: "asc" },
    });
  },

  async getMyApplications(creatorId: string) {
    return prisma.creatorCampaignApplication.findMany({
      where: { creatorId },
      include: { campaign: { select: { id: true, title: true, endDate: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async updateApplicationStatus(applicationId: string, status: string) {
    return prisma.creatorCampaignApplication.update({
      where: { id: applicationId },
      data: { status, reviewedAt: new Date() },
      include: { creator: { include: { user: { select: { id: true, name: true, email: true } } } }, campaign: { select: { id: true, title: true } } },
    });
  },

  // ── Collaborations ────────────────────────────────────────────────────

  async createCollaboration(data: CreatorCollaborationInput) {
    return prisma.creatorCollaboration.create({
      data: {
        campaignId: data.campaignId,
        creatorId: data.creatorId,
        organizerId: data.organizerId,
        agreedFee: data.agreedFee,
        currency: data.currency ?? "FCFA",
        deliverables: data.deliverables,
      },
      include: { creator: { include: { user: { select: { id: true, name: true } } } } },
    });
  },

  async getMyCollaborations(creatorId: string) {
    return prisma.creatorCollaboration.findMany({
      where: { creatorId },
      include: { campaign: { select: { id: true, title: true, endDate: true } }, organizer: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async updateCollaborationStatus(id: string, status: string, rating?: number, review?: string) {
    const data: Record<string, unknown> = { status };
    if (rating !== undefined) data.rating = rating;
    if (review !== undefined) data.review = review;
    if (status === "paid") data.paidAt = new Date();

    return prisma.creatorCollaboration.update({
      where: { id },
      data,
      include: { creator: { include: { user: { select: { id: true, name: true } } } }, campaign: { select: { id: true, title: true } }, organizer: { select: { id: true, name: true } } },
    });
  },

  async rateCollaboration(collabId: string, rating: number, review: string) {
    const collab = await prisma.creatorCollaboration.findUnique({
      where: { id: collabId },
      include: { creator: true },
    });
    if (!collab) return null;

    const oldCount = collab.creator.reviewCount;
    const oldRating = collab.creator.rating ?? 0;
    const newCount = oldCount + 1;
    const newRating = oldCount === 0 ? rating : (oldRating * oldCount + rating) / newCount;

    const [updatedCollab, updatedCreator] = await prisma.$transaction([
      prisma.creatorCollaboration.update({
        where: { id: collabId },
        data: { rating, review, status: "completed" },
      }),
      prisma.creator.update({
        where: { userId: collab.creatorId },
        data: {
          collaborationCount: { increment: 1 },
          rating: newRating,
          reviewCount: newCount,
        },
      }),
    ]);

    return { collaboration: updatedCollab, creator: updatedCreator };
  },

  async getStarsForAdmin(filters: { status?: string } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;

    return prisma.creatorCollaboration.findMany({
      where,
      include: {
        creator: { include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } } },
        campaign: { select: { id: true, title: true } },
        organizer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },
};

export { creatorRepository };
