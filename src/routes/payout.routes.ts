import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import { payoutController } from "../controllers/payout.controller.js";

const router = Router();

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);

// ─── Lecture ─────────────────────────────────────────────────────────
// L'organisateur peut voir ses propres payouts ; l'admin voit tout
router.get("/", wrap(payoutController.lister));
router.get("/:id", wrap(payoutController.getById));

// ─── Actions admin ───────────────────────────────────────────────────
router.post("/", requireRole("admin", "super_admin"), wrap(payoutController.initier));
router.post("/:id/approve", requireRole("admin", "super_admin"), wrap(payoutController.approuver));
router.post("/:id/execute", requireRole("admin", "super_admin"), wrap(payoutController.executer));
router.post("/:id/confirm", requireRole("admin", "super_admin"), wrap(payoutController.confirmer));
router.delete("/:id", requireRole("admin", "super_admin"), wrap(payoutController.annuler));

export default router;
