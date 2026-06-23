import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import {
  getMyCreatorProfile,
  createCreatorProfile,
  updateCreatorProfile,
  deleteMyCreatorProfile,
  listCreators,
  getCreatorById,
  adminListCreators,
  adminVerifyCreator,
  adminToggleCreatorActive,
  createCampaign,
  getMyCampaigns,
  getCampaignDetail,
  updateCampaignStatus,
  deleteCampaign,
  applyToCampaign,
  getMyApplications,
  getCampaignApplications,
  reviewApplication,
  createCollaboration,
  getMyCollaborations,
  updateCollaborationStatus,
  rateCollaboration,
  adminGetAllStars,
} from "../controller/creator.controller.js";

const router = Router();

// ── Créateur: mon profil ──────────────────────────────────────────────────

router.get("/creators/me", authenticate, getMyCreatorProfile);
router.post("/creators/me", authenticate, createCreatorProfile);
router.put("/creators/me", authenticate, updateCreatorProfile);
router.delete("/creators/me", authenticate, deleteMyCreatorProfile);

// ── Public: catalogue ──────────────────────────────────────────────────────

router.get("/creators", listCreators);
router.get("/creators/:id", getCreatorById);

// ── Organisateur: campagnes ────────────────────────────────────────────────

router.post("/creators/campaigns", authenticate, requireRole("organizer", "admin", "super_admin"), createCampaign);
router.get("/creators/campaigns/me", authenticate, requireRole("organizer", "admin", "super_admin"), getMyCampaigns);
router.get("/creators/campaigns/:id", authenticate, getCampaignDetail);
router.patch("/creators/campaigns/:id/status", authenticate, requireRole("organizer", "admin", "super_admin"), updateCampaignStatus);
router.delete("/creators/campaigns/:id", authenticate, requireRole("organizer", "admin", "super_admin"), deleteCampaign);

// ── Créateur: candidatures ────────────────────────────────────────────────

router.post("/creators/applications", authenticate, applyToCampaign);
router.get("/creators/applications/me", authenticate, getMyApplications);
router.get("/creators/campaigns/:campaignId/applications", authenticate, requireRole("organizer", "admin", "super_admin"), getCampaignApplications);
router.patch("/creators/applications/:applicationId", authenticate, requireRole("organizer", "admin", "super_admin"), reviewApplication);

// ── Créateur: collaborations ──────────────────────────────────────────────

router.post("/creators/collaborations", authenticate, requireRole("organizer", "admin", "super_admin"), createCollaboration);
router.get("/creators/collaborations/me", authenticate, getMyCollaborations);
router.patch("/creators/collaborations/:id/status", authenticate, requireRole("organizer", "admin", "super_admin"), updateCollaborationStatus);
router.post("/creators/collaborations/:id/rate", authenticate, requireRole("organizer", "admin", "super_admin"), rateCollaboration);

// ── Admin ─────────────────────────────────────────────────────────────────

router.get("/creators/admin/all", authenticate, requireRole("admin", "super_admin"), adminListCreators);
router.patch("/creators/admin/:id/verify", authenticate, requireRole("admin", "super_admin"), adminVerifyCreator);
router.patch("/creators/admin/:id/active", authenticate, requireRole("admin", "super_admin"), adminToggleCreatorActive);
router.get("/creators/admin/stars", authenticate, requireRole("admin", "super_admin"), adminGetAllStars);

export default router;
