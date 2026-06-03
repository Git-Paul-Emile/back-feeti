import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import { getAllUsers, updateUserRole, deleteUser, updateEventStatus, getAllAdminEvents, getTicketsStats, getAdminTickets, getAllCountriesAdmin, updateEventPromotion, getPromotionSlots, updateLeisurePromotion, getLeisurePromotionSlots, getAdminPromotions, getAdminPromotionStats, deactivatePromotion, getAdminPackConfigs, updatePackConfig, getDealPromotionSlots, updateDealPromotion } from "../controller/admin.controller.js";
import { createDeal, updateDeal, deleteDeal, getAllDealsAdmin } from "../controller/deal.controller.js";
import { createDealCategory, updateDealCategory, deleteDealCategory } from "../controller/dealCategory.controller.js";
import {
  getAllLeisureAdmin, createLeisureItem, updateLeisureItem, deleteLeisureItem,
  createLeisureCategory, updateLeisureCategory, deleteLeisureCategory,
} from "../controller/leisure.controller.js";
import {
  getAllZones, createZone, updateZone, deleteZone,
  getAllCities, createCity, updateCity, deleteCity,
} from "../controller/delivery.controller.js";
import { getSettings, updateSettings } from "../controller/settings.controller.js";
import { getPlatformPricing, updatePlatformPricing, getAllSubscriptions, getAllDealPayments } from "../controller/platformPricing.controller.js";
import { updateBadgePricing, getAdminBadgeOrders } from "../controller/access.controller.js";

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole("admin", "super_admin"));

router.get("/users", getAllUsers);
router.patch("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);
router.get("/events", getAllAdminEvents);
router.patch("/events/:id/status", updateEventStatus);
router.patch("/events/:id/promotion", updateEventPromotion);
router.get("/promotion-slots", getPromotionSlots);

// Suivi promotions self-service
router.get("/promotions", getAdminPromotions);
router.get("/promotions/stats", getAdminPromotionStats);
router.patch("/promotions/:id/deactivate", deactivatePromotion);

// Config des packs (prix, description, avantages)
router.get("/promotion-pack-configs", getAdminPackConfigs);
router.put("/promotion-pack-configs/:type", updatePackConfig);

// Deal (bon plan) admin routes
router.get("/deals", getAllDealsAdmin);
router.post("/deals", createDeal);
router.put("/deals/:id", updateDeal);
router.delete("/deals/:id", deleteDeal);
router.patch("/deals/:id/promotion", updateDealPromotion);
router.get("/deal-promotion-slots", getDealPromotionSlots);

// Deal categories admin routes
router.post("/deal-categories", createDealCategory);
router.put("/deal-categories/:id", updateDealCategory);
router.delete("/deal-categories/:id", deleteDealCategory);

// Leisure admin routes
router.get("/leisure", getAllLeisureAdmin);
router.get("/leisure-promotion-slots", getLeisurePromotionSlots);
router.post("/leisure", createLeisureItem);
router.put("/leisure/:id", updateLeisureItem);
router.delete("/leisure/:id", deleteLeisureItem);
router.patch("/leisure/:id/promotion", updateLeisurePromotion);

// Leisure categories admin routes
router.post("/leisure-categories", createLeisureCategory);
router.put("/leisure-categories/:id", updateLeisureCategory);
router.delete("/leisure-categories/:id", deleteLeisureCategory);

// Delivery zones admin routes
router.get("/delivery-zones", getAllZones);
router.post("/delivery-zones", createZone);
router.put("/delivery-zones/:id", updateZone);
router.delete("/delivery-zones/:id", deleteZone);

// Delivery cities admin routes
router.get("/delivery-cities", getAllCities);
router.post("/delivery-cities", createCity);
router.put("/delivery-cities/:id", updateCity);
router.delete("/delivery-cities/:id", deleteCity);

// Countries admin route (returns all including inactive)
router.get("/countries", getAllCountriesAdmin);

// Platform settings
router.get("/settings", getSettings);
router.put("/settings", updateSettings);

// Tarification établissements & bon plans
router.get("/platform-pricing", getPlatformPricing);
router.put("/platform-pricing", updatePlatformPricing);
router.get("/subscriptions", getAllSubscriptions);
router.get("/deal-payments", getAllDealPayments);

// Tarification badges Feeti Access
router.put("/badge-pricing", updateBadgePricing);
router.get("/badge-orders", getAdminBadgeOrders);

// Tickets admin routes
router.get("/tickets/stats", getTicketsStats);
router.get("/tickets", getAdminTickets);

export default router;
