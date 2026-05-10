import { Router } from "express";
import { createEvent, getMyEvents, getAllEvents, getEventById, deleteEvent, updateEvent, toggleFavorite, checkFavorite, getMyFavorites, toggleSalesBlocked } from "../controller/event.controller.js";
import { submitFeaturedRequest, getMyFeaturedRequests } from "../controller/featuredRequest.controller.js";
import { authenticate, requireRole, optionalAuthenticate } from "../middlewares/authenticate.js";

const router = Router();

// Public (auth optionnelle pour personnalisation par intérêts)
router.get("/", optionalAuthenticate, getAllEvents);

// Authenticated user routes (must be before /:id to avoid conflict)
router.get("/my", authenticate, requireRole("organizer", "admin", "super_admin"), getMyEvents);
router.get("/my-featured-requests", authenticate, requireRole("organizer", "admin", "super_admin"), getMyFeaturedRequests);
router.get("/favorites", authenticate, getMyFavorites);
router.get("/:id/favorite", authenticate, checkFavorite);
router.post("/:id/favorite", authenticate, toggleFavorite);
router.post("/:id/featured-request", authenticate, requireRole("organizer", "admin", "super_admin"), submitFeaturedRequest);

// Public (by id)
router.get("/:id", getEventById);

// Organizer only
router.post("/", authenticate, requireRole("organizer", "admin", "super_admin"), createEvent);
router.put("/:id", authenticate, requireRole("organizer", "admin", "super_admin"), updateEvent);
router.patch("/:id/toggle-sales-block", authenticate, requireRole("organizer", "admin", "super_admin"), toggleSalesBlocked);
router.delete("/:id", authenticate, requireRole("organizer", "admin", "super_admin"), deleteEvent);

export default router;
