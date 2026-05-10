import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import { reportingController } from "../controllers/reporting.controller.js";

const router = Router();

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);

// ─── Dashboard organisateur ──────────────────────────────────────────
router.get(
  "/dashboard",
  requireRole("organizer", "admin", "super_admin"),
  wrap(reportingController.dashboardOrganisateur)
);

// ─── Dashboard admin ─────────────────────────────────────────────────
router.get(
  "/admin/dashboard",
  requireRole("admin", "super_admin"),
  wrap(reportingController.dashboardAdmin)
);

// ─── Rapports spécifiques ────────────────────────────────────────────
router.get(
  "/tva",
  requireRole("organizer", "admin", "super_admin"),
  wrap(reportingController.rapportTVA)
);
router.get(
  "/tendances",
  requireRole("organizer", "admin", "super_admin"),
  wrap(reportingController.tendances)
);
router.get(
  "/remboursements",
  requireRole("organizer", "admin", "super_admin"),
  wrap(reportingController.remboursements)
);

// ─── Export ──────────────────────────────────────────────────────────
router.get(
  "/export/csv",
  requireRole("organizer", "admin", "super_admin"),
  wrap(reportingController.exportCSV)
);

// ─── Audit (admin uniquement) ─────────────────────────────────────────
router.get(
  "/audit",
  requireRole("admin", "super_admin"),
  wrap(reportingController.journalAudit)
);
router.get(
  "/audit/integrity",
  requireRole("admin", "super_admin"),
  wrap(reportingController.integritéAudit)
);
router.get(
  "/audit/:resource/:resourceId",
  requireRole("admin", "super_admin"),
  wrap(reportingController.auditRessource)
);

export default router;
