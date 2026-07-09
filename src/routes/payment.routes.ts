import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import {
  createStripeIntent,
  initializeMobileMoney,
  getMobileMoneyStatus,
  initializePaystack,
  confirmPaymentAndPurchase,
  verifyPayment,
} from "../controllers/payment.controller.js";

const router = Router();

// ─── Stripe ──────────────────────────────────────────────────────────
// POST /api/payments/stripe/create-intent
router.post("/stripe/create-intent", createStripeIntent);

// ─── Mobile Money ─────────────────────────────────────────────────────
// POST /api/payments/mobile-money/initialize
router.post("/mobile-money/initialize", initializeMobileMoney);

// GET /api/payments/mobile-money/status/:txId
router.get("/mobile-money/status/:txId", getMobileMoneyStatus);

// ─── Paystack ─────────────────────────────────────────────────────────
// POST /api/payments/paystack/initialize
router.post("/paystack/initialize", initializePaystack);

// ─── Confirmation paiement + création billets ─────────────────────────
// POST /api/payments/confirm  (requiert auth)
router.post("/confirm", authenticate, confirmPaymentAndPurchase);

// ─── Vérification seule (service-à-service, ex. FeetiPlay) ────────────
// POST /api/payments/verify  (protégé par x-feeti-sync-secret)
router.post("/verify", verifyPayment);

export default router;
