import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import {
  getPackConfigs,
  getNextSlotRelease,
  purchaseEventPromotion,
  getMyPromotions,
} from "../controller/promotion.controller.js";

const router = Router();

// Public : configs des packs (prix, description, avantages, slots)
router.get("/pack-configs", getPackConfigs);

// Public : prochain slot libre pour un type de pack
router.get("/slots/:type/next-release", getNextSlotRelease);

// Organisateur authentifié : achat d'un pack pour un événement
router.post(
  "/events/:id/promote",
  authenticate,
  requireRole("organizer", "admin", "super_admin"),
  purchaseEventPromotion
);

// Organisateur : historique de ses achats
router.get(
  "/my-promotions",
  authenticate,
  requireRole("organizer", "admin", "super_admin"),
  getMyPromotions
);

export default router;
