// @ts-nocheck
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { loyaltyService } from "../services/loyalty.service.js";

export const loyaltyController = {

  // ─── Profils utilisateur ────────────────────────────────────────────────────

  async getMyProfile(req: Request, res: Response) {
    const data = await loyaltyService.getMyProfile(req.user!.userId);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },
 
  async getMyLedger(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const data = await loyaltyService.getMyLedger(req.user!.userId, page, limit);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  // ─── Classement ─────────────────────────────────────────────────────────────

  async getLeaderboard(req: Request, res: Response) {
    const data = await loyaltyService.getLeaderboard(req.user!.userId);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  // ─── Récompenses ────────────────────────────────────────────────────────────

  async getRewards(req: Request, res: Response) {
    const data = await loyaltyService.getRewards();
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async redeemReward(req: Request, res: Response) {
    const { rewardId } = req.body;
    const data = await loyaltyService.redeemReward(req.user!.userId, rewardId);
    res.status(StatusCodes.OK).json({ status: "success", message: "Récompense échangée avec succès", data });
  },

  // ─── Missions ───────────────────────────────────────────────────────────────

  async getMissions(req: Request, res: Response) {
    const data = await loyaltyService.getMissionsForUser(req.user!.userId);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  // ─── Événements déclencheurs ─────────────────────────────────────────────

  async onEventShare(req: Request, res: Response) {
    const { eventId } = req.body;
    const data = await loyaltyService.onEventShare(req.user!.userId, eventId);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async onEventAttendance(req: Request, res: Response) {
    const { userId, eventId } = req.body;
    await loyaltyService.onEventAttendance(userId, eventId);
    res.status(StatusCodes.OK).json({ status: "success", message: "Points de présence attribués" });
  },

  async onTicketPurchase(req: Request, res: Response) {
    const { userId, amountFCFA, ticketId } = req.body;
    await loyaltyService.onTicketPurchase(userId, amountFCFA, ticketId);
    res.status(StatusCodes.OK).json({ status: "success", message: "Points d'achat attribués" });
  },

  // ─── Paiement partiel avec points ──────────────────────────────────────────

  async simulatePointsPayment(req: Request, res: Response) {
    const amountFCFA = parseInt(req.query.amount as string);
    if (!amountFCFA || amountFCFA <= 0) {
      res.status(StatusCodes.BAD_REQUEST).json({ status: "error", message: "Paramètre 'amount' invalide" });
      return;
    }
    const data = await loyaltyService.simulatePointsPayment(req.user!.userId, amountFCFA);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async applyPointsPayment(req: Request, res: Response) {
    const { pointsToUse, ticketId, amountFCFA } = req.body;
    const data = await loyaltyService.applyPointsPayment(req.user!.userId, pointsToUse, ticketId, amountFCFA);
    res.status(StatusCodes.OK).json({ status: "success", message: "Points appliqués au paiement", data });
  },

  // ─── Avantages VIP + ambassadeur ─────────────────────────────────────────

  async getVipBenefits(req: Request, res: Response) {
    const data = await loyaltyService.getVipBenefits(req.user!.userId);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async getAmbassadorStatus(req: Request, res: Response) {
    const data = await loyaltyService.getAmbassadorStatus(req.user!.userId);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  // ─── Parrainage ─────────────────────────────────────────────────────────────

  async applyReferralCode(req: Request, res: Response) {
    const { referralCode } = req.body;
    const data = await loyaltyService.applyReferralCode(req.user!.userId, referralCode);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  // ─── Partenaires marchands ───────────────────────────────────────────────────

  async getPublicPartners(req: Request, res: Response) {
    const data = await loyaltyService.getPublicPartners();
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async getPartnerDiscount(req: Request, res: Response) {
    const data = await loyaltyService.getPartnerDiscountForUser(req.user!.userId, req.params.id as string);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async recordPartnerSpending(req: Request, res: Response) {
    const { partnerId, amountFCFA, description } = req.body;
    const data = await loyaltyService.recordPartnerSpending(
      req.user!.userId, partnerId as string, amountFCFA, description ?? ""
    );
    res.status(StatusCodes.OK).json({ status: "success", message: "Dépense enregistrée", data });
  },

  // ─── Communauté ─────────────────────────────────────────────────────────────

  async getCommunityPosts(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const data = await loyaltyService.getCommunityPosts({ status: "approved", page, limit });
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async createCommunityPost(req: Request, res: Response) {
    const { title, content, image, eventId } = req.body;
    const data = await loyaltyService.createCommunityPost(req.user!.userId, { title, content, image, eventId });
    res.status(StatusCodes.CREATED).json({ status: "success", message: "Publication soumise pour modération", data });
  },

  async engageCommunityPost(req: Request, res: Response) {
    const { type, content } = req.body;
    const data = await loyaltyService.engageCommunityPost(req.user!.userId, req.params.id as string, type, content);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  // ─── Badges ─────────────────────────────────────────────────────────────────

  async getMyBadges(req: Request, res: Response) {
    const data = await loyaltyService.getMyBadges(req.user!.userId);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  // ─── Bonus actifs ───────────────────────────────────────────────────────────

  async getActiveBonuses(req: Request, res: Response) {
    const data = await loyaltyService.getActiveBonuses();
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  // ─── VIP ────────────────────────────────────────────────────────────────────

  async grantVipAccess(req: Request, res: Response) {
    const { userId, eventId, accessType, ticketId } = req.body;
    const data = await loyaltyService.grantVipAccess(userId, eventId, accessType, ticketId);
    res.status(StatusCodes.OK).json({ status: "success", message: "Accès VIP accordé", data });
  },

  async getMyVipAccess(req: Request, res: Response) {
    const data = await loyaltyService.getVipAccessLogs({ userId: req.user!.userId });
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  // ─── Administration ─────────────────────────────────────────────────────────

  async getAdminStats(req: Request, res: Response) {
    const data = await loyaltyService.getAdminStats();
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async getFraudAlerts(req: Request, res: Response) {
    const data = await loyaltyService.getFraudAlerts();
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async getAllUsers(req: Request, res: Response) {
    const search = req.query.search as string | undefined;
    const level = req.query.level as string | undefined;
    const pageQ = req.query.page as string | undefined;
    const limitQ = req.query.limit as string | undefined;
    const data = await loyaltyService.getAllUsers({
      search,
      level: level as any,
      page: pageQ ? parseInt(pageQ) : undefined,
      limit: limitQ ? parseInt(limitQ) : undefined,
    });
    res.status(StatusCodes.OK).json({ status: "success", ...data });
  },

  async getAllLedger(req: Request, res: Response) {
    const pageQ = req.query.page as string | undefined;
    const limitQ = req.query.limit as string | undefined;
    const action = req.query.action as string | undefined;
    const data = await loyaltyService.getAllLedger({
      page: pageQ ? parseInt(pageQ) : undefined,
      limit: limitQ ? parseInt(limitQ) : undefined,
      action: action as any,
    });
    res.status(StatusCodes.OK).json({ status: "success", ...data });
  },

  async manualAdjustPoints(req: Request, res: Response) {
    const { profileId, delta, description } = req.body;
    const data = await loyaltyService.manualAdjustPoints(profileId, delta, description, req.user!.userId);
    res.status(StatusCodes.OK).json({ status: "success", message: "Points ajustés", data });
  },

  async exportLedgerCSV(req: Request, res: Response) {
    const action = req.query.action as string | undefined;
    const csv = await loyaltyService.exportLedgerCSV({ action });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="feeti-na-feeti-ledger-${Date.now()}.csv"`);
    res.status(StatusCodes.OK).send(csv);
  },

  async exportPartnerSpendingCSV(req: Request, res: Response) {
    const csv = await loyaltyService.exportPartnerSpendingCSV();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="feeti-partenaires-${Date.now()}.csv"`);
    res.status(StatusCodes.OK).send(csv);
  },

  // Admin: Récompenses
  async getAdminRewards(req: Request, res: Response) {
    const data = await loyaltyService.getAdminRewards();
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async createReward(req: Request, res: Response) {
    const data = await loyaltyService.createReward(req.body);
    res.status(StatusCodes.CREATED).json({ status: "success", data });
  },

  async updateReward(req: Request, res: Response) {
    const data = await loyaltyService.updateReward(String(req.params.id), req.body);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async deleteReward(req: Request, res: Response) {
    await loyaltyService.deleteReward(String(req.params.id));
    res.status(StatusCodes.OK).json({ status: "success", message: "Récompense supprimée" });
  },

  // Admin: Partenaires
  async getAdminPartners(req: Request, res: Response) {
    const data = await loyaltyService.getAdminPartners();
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async createPartner(req: Request, res: Response) {
    const data = await loyaltyService.createPartner(req.body);
    res.status(StatusCodes.CREATED).json({ status: "success", data });
  },

  async updatePartner(req: Request, res: Response) {
    const data = await loyaltyService.updatePartner(String(req.params.id), req.body);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async deletePartner(req: Request, res: Response) {
    await loyaltyService.deletePartner(String(req.params.id));
    res.status(StatusCodes.OK).json({ status: "success", message: "Partenaire supprimé" });
  },

  async getAdminPartnerSpendings(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const partnerId = req.query.partnerId as string | undefined;
    const data = await loyaltyService.getPartnerSpendingStats({ page, limit, partnerId });
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  // Admin: Missions
  async getAdminMissions(req: Request, res: Response) {
    const data = await loyaltyService.getAdminMissions();
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async createMission(req: Request, res: Response) {
    const data = await loyaltyService.createMission(req.body);
    res.status(StatusCodes.CREATED).json({ status: "success", data });
  },

  async updateMission(req: Request, res: Response) {
    const data = await loyaltyService.updateMission(String(req.params.id), req.body);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async deleteMission(req: Request, res: Response) {
    await loyaltyService.deleteMission(String(req.params.id));
    res.status(StatusCodes.OK).json({ status: "success", message: "Mission supprimée" });
  },

  // Admin: Bonus / campagnes
  async getAllBonuses(req: Request, res: Response) {
    const data = await loyaltyService.getAllBonuses();
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async createBonus(req: Request, res: Response) {
    const data = await loyaltyService.createBonus(req.body);
    res.status(StatusCodes.CREATED).json({ status: "success", data });
  },

  async updateBonus(req: Request, res: Response) {
    const data = await loyaltyService.updateBonus(String(req.params.id), req.body);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async deleteBonus(req: Request, res: Response) {
    await loyaltyService.deleteBonus(String(req.params.id));
    res.status(StatusCodes.OK).json({ status: "success", message: "Bonus supprimé" });
  },

  // Admin: Communauté
  async getAdminCommunityPosts(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const data = await loyaltyService.getAdminCommunityPosts({ page, limit, status });
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async moderateCommunityPost(req: Request, res: Response) {
    const { status } = req.body;
    const data = await loyaltyService.moderateCommunityPost(req.params.id as string, status);
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  async adminDeleteCommunityPost(req: Request, res: Response) {
    await loyaltyService.adminDeleteCommunityPost(req.params.id as string);
    res.status(StatusCodes.OK).json({ status: "success", message: "Publication supprimée" });
  },

  // Admin: Badges
  async getAdminBadges(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await loyaltyService.getAdminBadges({ page, limit });
    res.status(StatusCodes.OK).json({ status: "success", data });
  },

  // Admin: VIP
  async getAdminVipLogs(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const eventId = req.query.eventId as string | undefined;
    const data = await loyaltyService.getVipAccessLogs({ page, limit, eventId });
    res.status(StatusCodes.OK).json({ status: "success", data });
  },
};
