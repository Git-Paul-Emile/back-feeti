import { Router } from "express";
import rateLimit from "express-rate-limit";
import { submitContactRequest } from "../controller/contact.controller.js";

const router = Router();

// Anti-spam : limite les envois répétés depuis une même IP.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop de demandes, réessayez plus tard." },
});

// Public — formulaire de la page Contact.
router.post("/", contactLimiter, submitContactRequest);

export default router;
