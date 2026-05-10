import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import {
  // Zones
  createZone, applyDefaultZones, getZones, updateZone, deleteZone,
  // Catégories
  createCategory, applyDefaultCategories, getCategories, updateCategory, deleteCategory,
  // Droits d'accès
  setAccessRights, applyDefaultMatrix, getAccessMatrix,
  // Badges
  generateBadge, getBadges, sendBadge, sendBadgeSms, revokeBadge, regenerateBadge, getCurrentQr,
  // Scan
  scanBadge, syncOffline, verifyAgentCode,
  // Tracking & Reporting
  getTracking, getAccessLogs, getRefusedAttempts, exportCsv, exportBadgesCsv, duplicateConfig,
  // Signalement
  reportSuspect, getSuspectReports,
} from "../controller/access.controller.js";

const router = Router();

const orgOrAdmin = requireRole("organizer", "admin", "super_admin");
const agentOrAbove = requireRole("controller", "organizer", "admin", "super_admin");

// ── Zones ─────────────────────────────────────────────────────────────
router.post  ("/events/:eventId/zones",                 authenticate, orgOrAdmin, createZone);
router.post  ("/events/:eventId/zones/apply-defaults",  authenticate, orgOrAdmin, applyDefaultZones);
router.get   ("/events/:eventId/zones",                 authenticate, agentOrAbove, getZones);
router.patch ("/events/:eventId/zones/:zoneId",         authenticate, orgOrAdmin, updateZone);
router.delete("/events/:eventId/zones/:zoneId",         authenticate, orgOrAdmin, deleteZone);

// ── Catégories ────────────────────────────────────────────────────────
router.post  ("/events/:eventId/categories",                    authenticate, orgOrAdmin, createCategory);
router.post  ("/events/:eventId/categories/apply-defaults",     authenticate, orgOrAdmin, applyDefaultCategories);
router.get   ("/events/:eventId/categories",                    authenticate, agentOrAbove, getCategories);
router.patch ("/events/:eventId/categories/:categoryId",        authenticate, orgOrAdmin, updateCategory);
router.delete("/events/:eventId/categories/:categoryId",        authenticate, orgOrAdmin, deleteCategory);

// ── Droits d'accès ────────────────────────────────────────────────────
router.put   ("/events/:eventId/access-rights",                 authenticate, orgOrAdmin, setAccessRights);
router.post  ("/events/:eventId/access-rights/apply-defaults",  authenticate, orgOrAdmin, applyDefaultMatrix);
router.get   ("/events/:eventId/access-rights",                 authenticate, agentOrAbove, getAccessMatrix);

// ── Badges ────────────────────────────────────────────────────────────
router.post  ("/events/:eventId/badges",                        authenticate, orgOrAdmin, generateBadge);
router.get   ("/events/:eventId/badges",                        authenticate, orgOrAdmin, getBadges);
router.post  ("/events/:eventId/badges/:badgeId/send",          authenticate, orgOrAdmin, sendBadge);
router.post  ("/events/:eventId/badges/:badgeId/send-sms",      authenticate, orgOrAdmin, sendBadgeSms);
router.post  ("/events/:eventId/badges/:badgeId/revoke",        authenticate, orgOrAdmin, revokeBadge);
router.post  ("/events/:eventId/badges/:badgeId/regenerate",    authenticate, orgOrAdmin, regenerateBadge);
router.get   ("/events/:eventId/badges/:badgeId/qr",            authenticate, orgOrAdmin, getCurrentQr);

// ── Scan (agents terrain) ─────────────────────────────────────────────
router.post  ("/scan",        authenticate, agentOrAbove, scanBadge);
router.post  ("/scan/sync",   authenticate, agentOrAbove, syncOffline);
router.post  ("/agent-code/verify", authenticate, agentOrAbove, verifyAgentCode);

// ── Tracking & Reporting ──────────────────────────────────────────────
router.get   ("/events/:eventId/tracking",        authenticate, orgOrAdmin, getTracking);
router.get   ("/events/:eventId/logs",            authenticate, orgOrAdmin, getAccessLogs);
router.get   ("/events/:eventId/logs/refused",    authenticate, orgOrAdmin, getRefusedAttempts);
router.get   ("/events/:eventId/export/csv",      authenticate, orgOrAdmin, exportCsv);
router.get   ("/events/:eventId/export/badges.csv", authenticate, orgOrAdmin, exportBadgesCsv);
router.post  ("/events/:eventId/duplicate-config", authenticate, orgOrAdmin, duplicateConfig);

// ── Signalement suspect ───────────────────────────────────────────────
router.post  ("/badges/:badgeId/report",          authenticate, agentOrAbove, reportSuspect);
router.get   ("/events/:eventId/reports/suspect", authenticate, orgOrAdmin, getSuspectReports);

export default router;
