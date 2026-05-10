import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import { walletController } from "../controllers/wallet.controller.js";

const router = Router();

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);

// ─── Organisateur : son propre wallet ────────────────────────────────
router.get("/me", requireRole("organizer", "admin", "super_admin"), wrap(walletController.monWallet));
router.get("/me/ledger", requireRole("organizer", "admin", "super_admin"), wrap(walletController.monLedger));
router.get("/me/integrity", requireRole("organizer", "admin", "super_admin"), wrap(walletController.verifierIntegrite));

// ─── Admin : wallets tiers ───────────────────────────────────────────
router.get("/:organizerId", requireRole("admin", "super_admin"), wrap(walletController.getByOrganizer));
router.get("/:organizerId/ledger", requireRole("admin", "super_admin"), wrap(walletController.ledgerByOrganizer));
router.post("/:organizerId/adjustment", requireRole("admin", "super_admin"), wrap(walletController.ajustement));

export default router;
