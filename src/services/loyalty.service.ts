import { StatusCodes } from "http-status-codes";
import { loyaltyRepository } from "../repositories/loyalty.repository.js";
import { AppError } from "../utils/AppError.js";

const MAX_SHARES_PER_DAY = 10;

// GAIN : 1 pt pour 100 FCFA dépensés sur un billet (PDF §Gains)
const POINTS_PER_100_FCFA = 1;
// RACHAT : 1 pt vaut 20 FCFA en réduction (PDF §Conversion)
export const POINT_VALUE_FCFA = 20;

const POINTS_EVENT_ATTENDANCE = 200;
const POINTS_SHARE = 20;
const POINTS_REFERRAL_SIGNUP = 150;
const POINTS_REFERRAL_FIRST_EVENT = 300;
const POINTS_PER_1000_FCFA_PARTNER = 1; // 1 pt / 1000 FCFA chez partenaire
const POINTS_COMMUNITY_POST = 50;
const POINTS_COMMUNITY_LIKE = 5;
const POINTS_COMMUNITY_COMMENT = 10;

// Remises par niveau pour les partenaires (défaut si non configuré sur le partenaire)
const DEFAULT_PARTNER_DISCOUNTS: Record<string, string> = {
  Mobembo: "5%",
  Elengi:  "10%",
  Momi:    "20%",
  Mwana:   "30%",
  Boboto:  "40%",
};

export const loyaltyService = {

  // ─── Profil utilisateur ────────────────────────────────────────────────────

  async getMyProfile(userId: string) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    const badges = await loyaltyRepository.getBadgesForUser(userId);
    return { ...formatProfile(profile), badges };
  },

  async getMyLedger(userId: string, page: number, limit: number) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    return loyaltyRepository.getLedger(profile.id, page, limit);
  },

  // ─── Événements déclencheurs de points ─────────────────────────────────────

  async onTicketPurchase(userId: string, amountFCFA: number, ticketId: string) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    const points = Math.floor(amountFCFA / 100) * POINTS_PER_100_FCFA;
    if (points <= 0) return;

    const bonusMultiplier = await getEffectiveMultiplier(profile.level, "ticket_purchase");
    const totalPoints = Math.round(points * bonusMultiplier);

    await loyaltyRepository.updatePoints(
      profile.id,
      totalPoints,
      "ticket_purchase",
      `Achat billet — ${amountFCFA.toLocaleString("fr-FR")} FCFA`,
      ticketId,
      "ticket"
    );

    await updateTotalSpent(profile.id, amountFCFA);
    await checkAndProgressMissions(profile.id, "ticket_purchase");
    await checkActivityBonus(profile.id, profile.level);
  },

  async onEventAttendance(userId: string, eventId: string) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);

    const bonusMultiplier = await getEffectiveMultiplier(profile.level, "event_attendance");
    const points = Math.round(POINTS_EVENT_ATTENDANCE * bonusMultiplier);

    await loyaltyRepository.updatePoints(
      profile.id,
      points,
      "event_attendance",
      `Présence à l'événement`,
      eventId,
      "event"
    );

    const { prisma } = await import("../config/database.js");
    await prisma.loyaltyProfile.update({
      where: { id: profile.id },
      data: { eventsAttended: { increment: 1 } },
    });

    await checkAndProgressMissions(profile.id, "event_attendance");
    await checkActivityBonus(profile.id, profile.level);

    // Bonus parrainage : premier événement
    if (!profile.referralFirstEventBonusPaid && profile.referredById) {
      const { prisma: db } = await import("../config/database.js");
      await db.loyaltyProfile.update({ where: { id: profile.id }, data: { referralFirstEventBonusPaid: true } });
      await loyaltyRepository.updatePoints(
        profile.referredById,
        POINTS_REFERRAL_FIRST_EVENT,
        "referral_first_event",
        `Bonus parrainage — premier événement de votre filleul`,
        profile.userId,
        "user"
      );
    }
  },

  async onEventShare(userId: string, eventId: string) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    const todayCount = await loyaltyRepository.getTodayShareCount(userId);

    if (todayCount >= MAX_SHARES_PER_DAY) {
      throw new AppError("Limite de partages journaliers atteinte (10/jour)", StatusCodes.TOO_MANY_REQUESTS);
    }

    await loyaltyRepository.incrementShareCount(userId);
    await loyaltyRepository.updatePoints(
      profile.id,
      POINTS_SHARE,
      "event_share",
      `Partage d'événement`,
      eventId,
      "event"
    );
    await checkAndProgressMissions(profile.id, "event_share");
    return { points: POINTS_SHARE };
  },

  // ─── Parrainage ─────────────────────────────────────────────────────────────

  async applyReferralCode(newUserId: string, referralCode: string) {
    const referrerProfile = await loyaltyRepository.getProfileByReferralCode(referralCode);
    if (!referrerProfile) throw new AppError("Code de parrainage invalide", StatusCodes.BAD_REQUEST);

    if (referrerProfile.userId === newUserId) {
      throw new AppError("Vous ne pouvez pas utiliser votre propre code", StatusCodes.BAD_REQUEST);
    }

    const newProfile = await loyaltyRepository.getOrCreateProfile(newUserId);
    if (newProfile.referredById) {
      throw new AppError("Un code de parrainage a déjà été appliqué", StatusCodes.BAD_REQUEST);
    }

    const { prisma } = await import("../config/database.js");
    await prisma.loyaltyProfile.update({
      where: { id: newProfile.id },
      data: { referredById: referrerProfile.id, referralSignupBonusPaid: true },
    });

    await loyaltyRepository.updatePoints(
      referrerProfile.id,
      POINTS_REFERRAL_SIGNUP,
      "referral_signup",
      `Parrainage — inscription de votre filleul`,
      newUserId,
      "user"
    );

    // Vérifier le badge parrainage
    const { prisma: db2 } = await import("../config/database.js");
    const referralCount = await db2.loyaltyProfile.count({ where: { referredById: referrerProfile.id } });
    await checkReferralBadge(referrerProfile.userId, referralCount);

    return { message: "Code de parrainage appliqué", pointsGiven: POINTS_REFERRAL_SIGNUP };
  },

  // ─── Paiement partiel avec points ──────────────────────────────────────────
  //
  // Règle PDF : 1 point = 20 FCFA de réduction.
  // Plafond de réduction : 50 % du montant TTC maximum (évite les abus).
  //
  async simulatePointsPayment(userId: string, amountFCFA: number) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    const maxDiscount = Math.floor(amountFCFA * 0.5);          // 50 % du total
    const maxPointsUsable = Math.floor(maxDiscount / POINT_VALUE_FCFA);
    const pointsUsable = Math.min(profile.points, maxPointsUsable);
    const discountFCFA = pointsUsable * POINT_VALUE_FCFA;
    const amountToPay = amountFCFA - discountFCFA;
    return {
      pointsAvailable: profile.points,
      pointsUsable,
      discountFCFA,
      amountToPay,
      amountFCFA,
      pointValueFCFA: POINT_VALUE_FCFA,
      maxPointsUsable,
    };
  },

  async applyPointsPayment(userId: string, pointsToUse: number, ticketId: string, amountFCFA: number) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    if (pointsToUse <= 0) throw new AppError("Nombre de points invalide", StatusCodes.BAD_REQUEST);
    if (profile.points < pointsToUse) {
      throw new AppError(`Points insuffisants (${profile.points} disponibles, ${pointsToUse} demandés)`, StatusCodes.BAD_REQUEST);
    }
    const maxDiscount = Math.floor(amountFCFA * 0.5);
    const maxPointsUsable = Math.floor(maxDiscount / POINT_VALUE_FCFA);
    if (pointsToUse > maxPointsUsable) {
      throw new AppError(`Maximum ${maxPointsUsable} points utilisables sur ce billet (plafond 50 %)`, StatusCodes.BAD_REQUEST);
    }
    const discountFCFA = pointsToUse * POINT_VALUE_FCFA;
    await loyaltyRepository.updatePoints(
      profile.id,
      -pointsToUse,
      "reward_redemption",
      `Réduction billet — ${discountFCFA.toLocaleString("fr-FR")} FCFA déduits`,
      ticketId,
      "ticket"
    );
    return { pointsUsed: pointsToUse, discountFCFA, amountToPay: amountFCFA - discountFCFA };
  },

  // ─── Avantages VIP + statut ambassadeur ─────────────────────────────────────

  async getVipBenefits(userId: string) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    const level = profile.level as string;

    const VIP_BENEFITS: Record<string, {
      partnerDiscounts: string[];
      eventAccess: string[];
      exclusivePerks: string[];
    }> = {
      Mobembo: {
        partnerDiscounts: ["5–10% chez les établissements partenaires"],
        eventAccess: [],
        exclusivePerks: ["Accès au programme de fidélité"],
      },
      Elengi: {
        partnerDiscounts: ["10–20% dans les restaurants partenaires", "20% sur les concerts et cinémas", "15–20% dans les boutiques"],
        eventAccess: ["Accès prioritaire aux événements"],
        exclusivePerks: ["10% bonus points sur toutes les actions"],
      },
      Momi: {
        partnerDiscounts: ["20–30% dans les établissements partenaires", "30% dans les salons / spas", "Offres 2+1 sélectionnés"],
        eventAccess: ["Zone VIP dans les événements", "File d'accès prioritaire"],
        exclusivePerks: ["15% bonus points", "Invitations événements exclusifs"],
      },
      Mwana: {
        partnerDiscounts: ["30–40% loisirs et restaurants", "30% chez les partenaires", "10% librairies", "Activités famille offertes"],
        eventAccess: ["Zone VIP", "Accès backstage", "Invitations événements privés"],
        exclusivePerks: ["20% bonus points", "Cadeau anniversaire exclusif", "Support prioritaire"],
      },
      Boboto: {
        partnerDiscounts: ["40% chez tous les partenaires", "15% labos médicaux", "10% médecins généralistes", "Hôtels premium tarif préférentiel"],
        eventAccess: ["Zone VIP premium", "Accès backstage", "Événements privés exclusifs", "Meet & Greet artistes"],
        exclusivePerks: ["30% bonus points sur tout", "Concierge VIP dédié", "Accès anticipé aux ventes de billets", "Surprise Boboto mensuelle"],
      },
    };

    const benefits = VIP_BENEFITS[level] ?? VIP_BENEFITS["Mobembo"];
    const nextLevelName = { Mobembo: "Elengi", Elengi: "Momi", Momi: "Mwana", Mwana: "Boboto", Boboto: null }[level];
    const thresholds: Record<string, number> = { Mobembo: 0, Elengi: 1000, Momi: 2000, Mwana: 3000, Boboto: 4000 };
    const nextThreshold = nextLevelName ? thresholds[nextLevelName] : null;
    const pointsToNext = nextThreshold ? Math.max(0, nextThreshold - profile.points) : 0;

    return {
      level,
      points: profile.points,
      nextLevel: nextLevelName,
      pointsToNext,
      benefits,
    };
  },

  async getAmbassadorStatus(userId: string) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    const badges = await loyaltyRepository.getBadgesForUser(userId);
    const { prisma } = await import("../config/database.js");

    const [
      postCount,
      referralCount,
      eventsAttended,
      vipLogs,
    ] = await Promise.all([
      prisma.communityPost.count({ where: { authorId: userId, status: "approved" } }),
      prisma.loyaltyProfile.count({ where: { referredById: profile.id } }),
      profile.eventsAttended,
      prisma.vipAccessLog.count({ where: { userId } }),
    ]);

    // Niveau ambassadeur calculé sur cumul de critères
    let ambassadorTier: "Bronze" | "Silver" | "Gold" | "Platinum" = "Bronze";
    const score = postCount * 2 + referralCount * 5 + eventsAttended + vipLogs * 3;
    if (score >= 100) ambassadorTier = "Platinum";
    else if (score >= 50) ambassadorTier = "Gold";
    else if (score >= 20) ambassadorTier = "Silver";

    return {
      ambassadorTier,
      score,
      stats: { postCount, referralCount, eventsAttended, vipLogs },
      badges,
      level: profile.level,
      points: profile.points,
    };
  },

  // ─── Récompenses ────────────────────────────────────────────────────────────

  async getRewards() {
    return loyaltyRepository.getRewards(true);
  },

  async redeemReward(userId: string, rewardId: string) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    const reward = await loyaltyRepository.getRewardById(rewardId);

    if (!reward) throw new AppError("Récompense introuvable", StatusCodes.NOT_FOUND);
    if (!reward.isActive) throw new AppError("Cette récompense n'est plus disponible", StatusCodes.BAD_REQUEST);
    if (reward.stock <= 0) throw new AppError("Stock épuisé", StatusCodes.BAD_REQUEST);
    if (profile.points < reward.points) {
      throw new AppError(`Points insuffisants (${profile.points}/${reward.points})`, StatusCodes.BAD_REQUEST);
    }

    await loyaltyRepository.decrementRewardStock(rewardId);
    await loyaltyRepository.updatePoints(
      profile.id,
      -reward.points,
      "reward_redemption",
      `Échange récompense : ${reward.title}`,
      rewardId,
      "reward"
    );
    const redemption = await loyaltyRepository.createRedemption(profile.id, rewardId, reward.points);
    return redemption;
  },

  // ─── Missions ───────────────────────────────────────────────────────────────

  async getMissionsForUser(userId: string) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    const [missions, progress] = await Promise.all([
      loyaltyRepository.getMissions(true),
      loyaltyRepository.getMissionProgressForUser(profile.id),
    ]);

    return missions.map((mission) => {
      const prog = progress.find((p) => p.missionId === mission.id);
      return {
        ...mission,
        progress: prog?.progress ?? 0,
        completed: prog?.completed ?? false,
        rewardPaid: prog?.rewardPaid ?? false,
      };
    });
  },

  // ─── Classement ─────────────────────────────────────────────────────────────

  async getLeaderboard(userId: string) {
    const top = await loyaltyRepository.getLeaderboard(20);
    const profile = await loyaltyRepository.getOrCreateProfile(userId);

    const formatted = top.map((p, i) => ({
      rank: i + 1,
      userId: p.user.id,
      name: p.user.name,
      points: p.points,
      level: p.level,
      isCurrentUser: p.userId === userId,
    }));

    const userInTop = formatted.find((u) => u.isCurrentUser);
    if (!userInTop) {
      const { prisma } = await import("../config/database.js");
      const rank =
        (await prisma.loyaltyProfile.count({ where: { points: { gt: profile.points } } })) + 1;
      formatted.push({
        rank,
        userId: profile.user.id,
        name: profile.user.name,
        points: profile.points,
        level: profile.level,
        isCurrentUser: true,
      });
    }

    return formatted;
  },

  // ─── Partenaires marchands ───────────────────────────────────────────────────

  async getPublicPartners() {
    return loyaltyRepository.getPartners(true);
  },

  async recordPartnerSpending(userId: string, partnerId: string, amountFCFA: number, description: string) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    const partner = await loyaltyRepository.getPartnerById(partnerId);
    if (!partner || !partner.isActive) throw new AppError("Partenaire introuvable ou inactif", StatusCodes.NOT_FOUND);

    // Points : 1 pt par 1000 FCFA + bonus partenaire
    const basePoints = Math.floor(amountFCFA / 1000) * POINTS_PER_1000_FCFA_PARTNER;
    const bonusPoints = partner.bonusPoints > 0 ? Math.floor(amountFCFA / 1000) * partner.bonusPoints : 0;
    const multiplier = await getEffectiveMultiplier(profile.level, "partner_spending");
    const totalPoints = Math.round((basePoints + bonusPoints) * multiplier);

    await loyaltyRepository.recordPartnerSpending({
      userId,
      partnerId,
      amountFCFA,
      pointsEarned: totalPoints,
      description,
    });

    if (totalPoints > 0) {
      await loyaltyRepository.updatePoints(
        profile.id,
        totalPoints,
        "partner_spending",
        `Dépense chez ${partner.name} — ${amountFCFA.toLocaleString("fr-FR")} FCFA`,
        partnerId,
        "partner"
      );
    }

    await checkAndProgressMissions(profile.id, "partner_spending");

    return { pointsEarned: totalPoints, partner: partner.name };
  },

  async getPartnerDiscountForUser(userId: string, partnerId: string) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    const partner = await loyaltyRepository.getPartnerById(partnerId);
    if (!partner) throw new AppError("Partenaire introuvable", StatusCodes.NOT_FOUND);

    const byLevel = partner.discountByLevel as Record<string, string>;
    const discount = byLevel[profile.level] ?? DEFAULT_PARTNER_DISCOUNTS[profile.level] ?? partner.discount;

    return {
      partner: { id: partner.id, name: partner.name, category: partner.category },
      userLevel: profile.level,
      discount,
      bonusPoints: partner.bonusPoints,
    };
  },

  async getPartnerSpendingStats(filters: any) {
    return loyaltyRepository.getPartnerSpendingStats(filters);
  },

  // ─── Communauté ────────────────────────────────────────────────────────────

  async getCommunityPosts(filters: { status?: string; page?: number; limit?: number }) {
    return loyaltyRepository.getCommunityPosts(filters);
  },

  async createCommunityPost(userId: string, data: { title: string; content: string; image?: string; eventId?: string }) {
    const post = await loyaltyRepository.createCommunityPost({ authorId: userId, ...data });

    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    await loyaltyRepository.updatePoints(
      profile.id,
      POINTS_COMMUNITY_POST,
      "community_post",
      `Publication communauté : ${data.title}`,
      post.id,
      "post"
    );
    await checkAndProgressMissions(profile.id, "community_post");
    await checkContentCreatorBadge(userId);

    return post;
  },

  async engageCommunityPost(userId: string, postId: string, type: "like" | "comment", content?: string) {
    const post = await loyaltyRepository.getCommunityPostById(postId);
    if (!post || post.status !== "approved") throw new AppError("Publication introuvable", StatusCodes.NOT_FOUND);

    const alreadyEngaged = await loyaltyRepository.hasEngaged(userId, postId, type);
    if (alreadyEngaged && type === "like") throw new AppError("Déjà liké", StatusCodes.CONFLICT);

    await loyaltyRepository.engagePost(userId, postId, type, content);

    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    const pts = type === "like" ? POINTS_COMMUNITY_LIKE : POINTS_COMMUNITY_COMMENT;
    await loyaltyRepository.updatePoints(
      profile.id,
      pts,
      "community_engagement",
      `${type === "like" ? "Like" : "Commentaire"} sur publication`,
      postId,
      "post"
    );

    return { pointsEarned: pts };
  },

  async moderateCommunityPost(postId: string, status: "approved" | "rejected") {
    return loyaltyRepository.updateCommunityPost(postId, { status });
  },

  // ─── Badges ambassadeur ────────────────────────────────────────────────────

  async getMyBadges(userId: string) {
    return loyaltyRepository.getBadgesForUser(userId);
  },

  // ─── Bonus / campagnes ─────────────────────────────────────────────────────

  async getActiveBonuses() {
    return loyaltyRepository.getActiveBonuses();
  },

  async getAllBonuses() {
    return loyaltyRepository.getAllBonuses();
  },

  async createBonus(data: any) {
    return loyaltyRepository.createBonus(data);
  },

  async updateBonus(id: string, data: any) {
    return loyaltyRepository.updateBonus(id, data);
  },

  async deleteBonus(id: string) {
    return loyaltyRepository.deleteBonus(id);
  },

  // ─── VIP ────────────────────────────────────────────────────────────────────

  async grantVipAccess(userId: string, eventId: string, accessType: string, ticketId?: string) {
    const profile = await loyaltyRepository.getOrCreateProfile(userId);
    const vipLevels = ["Momi", "Mwana", "Boboto"];

    if (accessType === "backstage" && !["Mwana", "Boboto"].includes(profile.level)) {
      throw new AppError(`Accès backstage réservé aux niveaux Mwana et Boboto (niveau actuel: ${profile.level})`, StatusCodes.FORBIDDEN);
    }
    if (accessType === "vip_area" && !vipLevels.includes(profile.level)) {
      throw new AppError(`Accès VIP réservé aux niveaux Momi, Mwana et Boboto (niveau actuel: ${profile.level})`, StatusCodes.FORBIDDEN);
    }

    return loyaltyRepository.logVipAccess({ userId, eventId, accessType, ticketId });
  },

  async getVipAccessLogs(filters: any) {
    return loyaltyRepository.getVipAccessLogs(filters);
  },

  // ─── Administration ──────────────────────────────────────────────────────────

  async getAdminStats() {
    return loyaltyRepository.getAdminStats();
  },

  async getFraudAlerts() {
    return loyaltyRepository.getFraudAlerts();
  },

  async getAllUsers(filters: { search?: string; level?: any; page?: number; limit?: number }) {
    return loyaltyRepository.getAllProfiles(filters);
  },

  async getAllLedger(filters: { page?: number; limit?: number; action?: any }) {
    return loyaltyRepository.getAllLedger(filters);
  },

  async manualAdjustPoints(profileId: string, delta: number, description: string, adminId: string) {
    return loyaltyRepository.manualAdjustPoints(profileId, delta, description, adminId);
  },

  async getAdminRewards() {
    return loyaltyRepository.getRewards(false);
  },

  async createReward(data: any) {
    return loyaltyRepository.createReward(data);
  },

  async updateReward(id: string, data: any) {
    return loyaltyRepository.updateReward(id, data);
  },

  async deleteReward(id: string) {
    return loyaltyRepository.deleteReward(id);
  },

  async getAdminPartners() {
    return loyaltyRepository.getPartners(false);
  },

  async createPartner(data: any) {
    return loyaltyRepository.createPartner(data);
  },

  async updatePartner(id: string, data: any) {
    return loyaltyRepository.updatePartner(id, data);
  },

  async deletePartner(id: string) {
    return loyaltyRepository.deletePartner(id);
  },

  async getAdminMissions() {
    return loyaltyRepository.getMissions(false);
  },

  async createMission(data: any) {
    return loyaltyRepository.createMission(data);
  },

  async updateMission(id: string, data: any) {
    return loyaltyRepository.updateMission(id, data);
  },

  async deleteMission(id: string) {
    return loyaltyRepository.deleteMission(id);
  },

  async getAdminBadges(filters: any) {
    return loyaltyRepository.getAllBadges(filters);
  },

  async getAdminCommunityPosts(filters: any) {
    return loyaltyRepository.getCommunityPosts(filters);
  },

  async adminUpdateCommunityPost(postId: string, data: any) {
    return loyaltyRepository.updateCommunityPost(postId, data);
  },

  async adminDeleteCommunityPost(postId: string) {
    return loyaltyRepository.deleteCommunityPost(postId);
  },

  async exportLedgerCSV(filters: any) {
    const data = await loyaltyRepository.getAllLedger({ ...filters, limit: 10000 });
    const header = "ID,Utilisateur,Email,Action,Points,Solde avant,Solde après,Description,Date";
    const rows = data.items.map((tx: any) => [
      tx.id,
      tx.profile?.user?.name ?? "",
      tx.profile?.user?.email ?? "",
      tx.action,
      tx.points,
      tx.balanceBefore,
      tx.balanceAfter,
      `"${tx.description.replace(/"/g, '""')}"`,
      new Date(tx.createdAt).toISOString(),
    ].join(","));
    return [header, ...rows].join("\n");
  },

  async exportPartnerSpendingCSV() {
    const data = await loyaltyRepository.getPartnerSpendingStats({ limit: 10000 });
    const header = "ID,Partenaire,Catégorie,Montant FCFA,Points gagnés,Description,Date";
    const rows = data.items.map((s: any) => [
      s.id,
      s.partner?.name ?? "",
      s.partner?.category ?? "",
      s.amountFCFA,
      s.pointsEarned,
      `"${s.description.replace(/"/g, '""')}"`,
      new Date(s.createdAt).toISOString(),
    ].join(","));
    return [header, ...rows].join("\n");
  },
};

// ─── Helpers internes ─────────────────────────────────────────────────────────

function getLevelBonus(level: string): number {
  switch (level) {
    case "Elengi": return 1.10;
    case "Momi":   return 1.15;
    case "Mwana":  return 1.20;
    case "Boboto": return 1.30;
    default:       return 1.00;
  }
}

async function getEffectiveMultiplier(level: string, actionType: string): Promise<number> {
  const base = getLevelBonus(level);
  // Chercher les bonus campagnes actifs
  const bonuses = await loyaltyRepository.getActiveBonuses(actionType);
  let extra = 0;
  for (const bonus of bonuses) {
    if (bonus.bonusType === "multiplier") {
      extra += (bonus.value - 1); // ex: value=1.5 → +0.5
    }
  }
  return base + extra;
}

async function updateTotalSpent(profileId: string, amountFCFA: number) {
  const { prisma } = await import("../config/database.js");
  await prisma.loyaltyProfile.update({
    where: { id: profileId },
    data: { totalSpent: { increment: amountFCFA } },
  });
}

async function checkAndProgressMissions(profileId: string, actionType: string) {
  const missions = await loyaltyRepository.getMissions(true);
  for (const mission of missions) {
    if (mission.actionType !== actionType) continue;
    const prog = await loyaltyRepository.upsertMissionProgress(profileId, mission.id, 1);
    if (prog.completed && !prog.rewardPaid) {
      await loyaltyRepository.markMissionRewardPaid(prog.id);
      await loyaltyRepository.updatePoints(
        profileId,
        mission.points,
        "mission_complete",
        `Mission accomplie : ${mission.title}`,
        mission.id,
        "mission"
      );
    }
  }
}

// Bonus activité : paliers d'événements dans le mois en cours
async function checkActivityBonus(profileId: string, level: string) {
  const { prisma } = await import("../config/database.js");
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const eventsThisMonth = await prisma.pointsLedger.count({
    where: { profileId, action: "event_attendance", createdAt: { gte: startOfMonth } },
  });

  // Paliers : 3 events → +150 pts, 5 events → +300 pts (une seule fois chacun)
  const thresholds: { count: number; pts: number; label: string }[] = [
    { count: 3, pts: 150, label: "Bonus activité : 3 événements ce mois" },
    { count: 5, pts: 300, label: "Bonus activité : 5 événements ce mois" },
  ];

  for (const threshold of thresholds) {
    if (eventsThisMonth === threshold.count) {
      // Vérifier si ce bonus a déjà été payé ce mois
      const already = await prisma.pointsLedger.count({
        where: {
          profileId,
          action: "activity_bonus",
          description: threshold.label,
          createdAt: { gte: startOfMonth },
        },
      });
      if (already === 0) {
        await loyaltyRepository.updatePoints(profileId, threshold.pts, "activity_bonus", threshold.label);
      }
    }
  }
}

async function checkReferralBadge(userId: string, referralCount: number) {
  const thresholds = [
    { count: 1,  type: "first_referral",    title: "Premier parrain",     desc: "Vous avez parrainé votre premier filleul" },
    { count: 5,  type: "referral_master",    title: "Maître du parrainage",desc: "5 filleuls parrainés avec succès" },
    { count: 10, type: "referral_legend",    title: "Légende du parrainage",desc: "10 filleuls parrainés" },
  ];
  for (const t of thresholds) {
    if (referralCount >= t.count) {
      await loyaltyRepository.awardBadge({ userId, badgeType: t.type, title: t.title, description: t.desc });
    }
  }
}

async function checkContentCreatorBadge(userId: string) {
  const { prisma } = await import("../config/database.js");
  const postCount = await prisma.communityPost.count({ where: { authorId: userId } });
  const thresholds = [
    { count: 1,  type: "first_post",        title: "Première publication",  desc: "Vous avez publié votre premier contenu" },
    { count: 5,  type: "content_creator",   title: "Créateur de contenu",   desc: "5 publications dans la communauté" },
    { count: 20, type: "community_star",    title: "Étoile de la communauté",desc: "20 publications approuvées" },
  ];
  for (const t of thresholds) {
    if (postCount >= t.count) {
      await loyaltyRepository.awardBadge({ userId, badgeType: t.type, title: t.title, description: t.desc });
    }
  }
}

function formatProfile(profile: any) {
  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.user.name,
    email: profile.user.email,
    points: profile.points,
    pointsEarned: profile.pointsEarned,
    pointsSpent: profile.pointsSpent,
    level: profile.level,
    eventsAttended: profile.eventsAttended,
    totalSpent: profile.totalSpent,
    referralCode: profile.referralCode,
    referrals: profile.referrals?.length ?? 0,
    createdAt: profile.createdAt,
  };
}
