import { Router } from "express";
import rateLimit from "express-rate-limit";
import { subscribeToNewsletter, unsubscribeFromNewsletter } from "../controller/newsletter.controller.js";

const router = Router();

// Anti-spam : limite les inscriptions répétées depuis une même IP.
const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop de tentatives, réessayez plus tard." },
});

// Public — formulaire newsletter du footer.
router.post("/subscribe", subscribeLimiter, subscribeToNewsletter);

// Public — lien "se désinscrire" dans le footer de l'email.
router.get("/unsubscribe/:token", unsubscribeFromNewsletter);

export default router;
