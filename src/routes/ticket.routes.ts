import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import {
  purchaseTickets,
  getMyTickets,
  getTicketById,
  verifyTicket,
  getEventTickets,
  requestRefund,
  downloadTicketPDF,
} from "../controller/ticket.controller.js";

const router = Router();

// Acheteur : acheter des billets
router.post("/purchase", authenticate, purchaseTickets);

// Acheteur : voir ses billets
router.get("/my", authenticate, getMyTickets);

// Téléchargement PDF direct (pas d'auth — lien depuis email)
router.get("/:id/download", downloadTicketPDF);

// Acheteur/Admin/Organisateur : voir un billet
router.get("/:id", authenticate, getTicketById);

// Organisateur/Admin : vérifier un QR code
router.post("/verify", authenticate, requireRole("organizer", "admin", "super_admin"), verifyTicket);

// Acheteur : demander un remboursement
router.post("/:id/refund-request", authenticate, requestRefund);

// Organisateur/Admin : voir les billets d'un événement
router.get("/event/:eventId", authenticate, requireRole("organizer", "admin", "super_admin"), getEventTickets);

export default router;
