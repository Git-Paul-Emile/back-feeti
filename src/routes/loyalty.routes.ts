import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import { loyaltyController } from "../controllers/loyalty.controller.js";

const router = Router();
const adminOnly = [authenticate, requireRole("admin", "super_admin")];

// ─── Routes utilisateur (authentifié) ─────────────────────────────────────────

// Profil & historique
router.get("/me", authenticate, loyaltyController.getMyProfile);
router.get("/me/ledger", authenticate, loyaltyController.getMyLedger);
router.get("/me/badges", authenticate, loyaltyController.getMyBadges);
router.get("/me/vip", authenticate, loyaltyController.getMyVipAccess);

// Classement
router.get("/leaderboard", authenticate, loyaltyController.getLeaderboard);

// Récompenses catalogue
router.get("/rewards", authenticate, loyaltyController.getRewards);
router.post("/rewards/redeem", authenticate, loyaltyController.redeemReward);

// Missions
router.get("/missions", authenticate, loyaltyController.getMissions);

// Parrainage
router.post("/referral/apply", authenticate, loyaltyController.applyReferralCode);

// Déclencheurs de points
router.post("/actions/share", authenticate, loyaltyController.onEventShare);

// Partenaires marchands (lecture publique, dépenses authentifiées)
router.get("/partners", authenticate, loyaltyController.getPublicPartners);
router.get("/partners/:id/discount", authenticate, loyaltyController.getPartnerDiscount);
router.post("/partners/spending", authenticate, loyaltyController.recordPartnerSpending);

// Communauté
router.get("/community/posts", authenticate, loyaltyController.getCommunityPosts);
router.post("/community/posts", authenticate, loyaltyController.createCommunityPost);
router.post("/community/posts/:id/engage", authenticate, loyaltyController.engageCommunityPost);

// Bonus actifs (info publique pour l'utilisateur)
router.get("/bonuses/active", authenticate, loyaltyController.getActiveBonuses);

// Paiement partiel avec points
router.get("/points/simulate-payment", authenticate, loyaltyController.simulatePointsPayment);
router.post("/points/apply-payment", authenticate, loyaltyController.applyPointsPayment);

// Avantages VIP + ambassadeur
router.get("/me/vip-benefits", authenticate, loyaltyController.getVipBenefits);
router.get("/me/ambassador", authenticate, loyaltyController.getAmbassadorStatus);

// ─── Routes internes (appelées depuis d'autres services) ────────────────────

router.post(
  "/actions/attendance",
  authenticate,
  requireRole("controller", "organizer", "admin", "super_admin"),
  loyaltyController.onEventAttendance
);

router.post(
  "/actions/ticket-purchase",
  authenticate,
  requireRole("admin", "super_admin"),
  loyaltyController.onTicketPurchase
);

router.post(
  "/actions/vip-access",
  authenticate,
  requireRole("controller", "organizer", "admin", "super_admin"),
  loyaltyController.grantVipAccess
);

// ─── Routes administration ───────────────────────────────────────────────────

// Stats & alertes
router.get("/admin/stats", ...adminOnly, loyaltyController.getAdminStats);
router.get("/admin/fraud-alerts", ...adminOnly, loyaltyController.getFraudAlerts);

// Utilisateurs
router.get("/admin/users", ...adminOnly, loyaltyController.getAllUsers);
router.post("/admin/adjust", ...adminOnly, loyaltyController.manualAdjustPoints);

// Ledger
router.get("/admin/ledger", ...adminOnly, loyaltyController.getAllLedger);
router.get("/admin/export/ledger", ...adminOnly, loyaltyController.exportLedgerCSV);
router.get("/admin/export/partner-spendings", ...adminOnly, loyaltyController.exportPartnerSpendingCSV);

// Récompenses admin
router.get("/admin/rewards", ...adminOnly, loyaltyController.getAdminRewards);
router.post("/admin/rewards", ...adminOnly, loyaltyController.createReward);
router.put("/admin/rewards/:id", ...adminOnly, loyaltyController.updateReward);
router.delete("/admin/rewards/:id", ...adminOnly, loyaltyController.deleteReward);

// Partenaires admin
router.get("/admin/partners", ...adminOnly, loyaltyController.getAdminPartners);
router.post("/admin/partners", ...adminOnly, loyaltyController.createPartner);
router.put("/admin/partners/:id", ...adminOnly, loyaltyController.updatePartner);
router.delete("/admin/partners/:id", ...adminOnly, loyaltyController.deletePartner);
router.get("/admin/partners/spendings", ...adminOnly, loyaltyController.getAdminPartnerSpendings);

// Missions admin
router.get("/admin/missions", ...adminOnly, loyaltyController.getAdminMissions);
router.post("/admin/missions", ...adminOnly, loyaltyController.createMission);
router.put("/admin/missions/:id", ...adminOnly, loyaltyController.updateMission);
router.delete("/admin/missions/:id", ...adminOnly, loyaltyController.deleteMission);

// Bonus / campagnes
router.get("/admin/bonuses", ...adminOnly, loyaltyController.getAllBonuses);
router.post("/admin/bonuses", ...adminOnly, loyaltyController.createBonus);
router.put("/admin/bonuses/:id", ...adminOnly, loyaltyController.updateBonus);
router.delete("/admin/bonuses/:id", ...adminOnly, loyaltyController.deleteBonus);

// Communauté admin
router.get("/admin/community/posts", ...adminOnly, loyaltyController.getAdminCommunityPosts);
router.put("/admin/community/posts/:id/moderate", ...adminOnly, loyaltyController.moderateCommunityPost);
router.delete("/admin/community/posts/:id", ...adminOnly, loyaltyController.adminDeleteCommunityPost);

// Badges admin
router.get("/admin/badges", ...adminOnly, loyaltyController.getAdminBadges);

// Accès VIP admin
router.get("/admin/vip-logs", ...adminOnly, loyaltyController.getAdminVipLogs);

export default router;
