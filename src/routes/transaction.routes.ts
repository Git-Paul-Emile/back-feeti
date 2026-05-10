import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import { transactionController } from "../controllers/transaction.controller.js";

const router = Router();

// Utilitaire de wrap async
const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ─── Routes publiques (simulateur) ───────────────────────────────────
router.get("/simulate", wrap(transactionController.simuler));

// ─── Routes authentifiées ─────────────────────────────────────────────
router.use(authenticate);

// Liste des transactions (filtrée selon le rôle)
router.get("/", wrap(transactionController.lister));

// Export CSV
router.get("/export/csv", wrap(transactionController.exportCSV));

// Détail d'une transaction
router.get("/:id", wrap(transactionController.getById));

// Créer une transaction (système/webhook uniquement)
router.post(
  "/",
  requireRole("admin", "super_admin"),
  wrap(transactionController.creer)
);

// Changer le statut (admin)
router.patch(
  "/:id/status",
  requireRole("admin", "super_admin"),
  wrap(transactionController.changerStatut)
);

// Compléter une transaction (admin)
router.post(
  "/:id/complete",
  requireRole("admin", "super_admin"),
  wrap(transactionController.completer)
);

// Initier un remboursement (admin)
router.post(
  "/:id/refund",
  requireRole("admin", "super_admin"),
  wrap(transactionController.rembourser)
);

export default router;
