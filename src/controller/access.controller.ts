import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { ZoneAccessLevel } from "../generated/prisma/client.js";
import { accessService } from "../services/access.service.js";
import { auditService } from "../services/audit.service.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import {
  createZoneSchema,
  updateZoneSchema,
  createCategorySchema,
  updateCategorySchema,
  setAccessRightsSchema,
  generateBadgeSchema,
  generateStandaloneBadgeSchema,
  scanSchema,
  syncOfflineSchema,
  reportSuspectSchema,
  verifyAgentCodeSchema,
  sendBadgeSmsSchema,
  duplicateConfigSchema,
} from "../validators/access.validator.js";

const normalizeEventId = (value: string) => value.replace(/^feeti2_live_/, '');
const p = (v: unknown) => normalizeEventId(String(v));

async function auditAccessAction(
  req: Request,
  action: string,
  resource: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
) {
  const actor = req.user;
  if (!actor) return;
  await auditService.log({
    userId: actor.userId,
    userRole: actor.role,
    action,
    resource,
    resourceId,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    metadata,
  });
}

// ─── Zones ────────────────────────────────────────────────────────────

export const createZone = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const data = createZoneSchema.parse(req.body);
  const zone = await accessService.createZone(eventId, userId, role, data);
  res.status(StatusCodes.CREATED).json(jsonResponse({ status: "success", message: "Zone créée", data: zone }));
});

export const applyDefaultZones = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const zones = await accessService.applyDefaultZones(eventId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Templates appliqués", data: zones }));
});

export const getZones = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const zones = await accessService.getZones(eventId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Zones récupérées", data: zones }));
});

export const updateZone = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const zoneId = p(req.params.zoneId);
  const { userId, role } = req.user!;
  const data = updateZoneSchema.parse(req.body);
  const zone = await accessService.updateZone(eventId, zoneId, userId, role, data);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Zone mise à jour", data: zone }));
});

export const deleteZone = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const zoneId = p(req.params.zoneId);
  const { userId, role } = req.user!;
  await accessService.deleteZone(eventId, zoneId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Zone supprimée" }));
});

// ─── Catégories ───────────────────────────────────────────────────────

export const createCategory = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const data = createCategorySchema.parse(req.body);
  const cat = await accessService.createCategory(eventId, userId, role, data);
  res.status(StatusCodes.CREATED).json(jsonResponse({ status: "success", message: "Catégorie créée", data: cat }));
});

export const applyDefaultCategories = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const cats = await accessService.applyDefaultCategories(eventId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Catégories par défaut appliquées", data: cats }));
});

export const getCategories = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const cats = await accessService.getCategories(eventId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Catégories récupérées", data: cats }));
});

export const updateCategory = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const categoryId = p(req.params.categoryId);
  const { userId, role } = req.user!;
  const data = updateCategorySchema.parse(req.body);
  const cat = await accessService.updateCategory(eventId, categoryId, userId, role, data);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Catégorie mise à jour", data: cat }));
});

export const deleteCategory = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const categoryId = p(req.params.categoryId);
  const { userId, role } = req.user!;
  await accessService.deleteCategory(eventId, categoryId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Catégorie supprimée" }));
});

// ─── Droits d'accès ───────────────────────────────────────────────────

export const setAccessRights = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const { rights } = setAccessRightsSchema.parse(req.body);
  const result = await accessService.setAccessRights(
    eventId, userId, role,
    rights as { categoryId: string; zoneId: string; accessLevel: ZoneAccessLevel }[]
  );
  await auditAccessAction(req, "ACCESS_RIGHTS_UPDATED", "EventAccess", eventId, { rightsCount: rights.length });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Droits d'accès mis à jour", data: result }));
});

export const applyDefaultMatrix = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const result = await accessService.applyDefaultMatrix(eventId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Matrice par défaut appliquée", data: result }));
});

export const getAccessMatrix = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const matrix = await accessService.getAccessMatrix(eventId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Matrice récupérée", data: matrix }));
});

// ─── Badges ───────────────────────────────────────────────────────────

export const generateBadge = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const data = generateBadgeSchema.parse(req.body);
  const badge = await accessService.generateBadge(eventId, userId, role, data);
  await auditAccessAction(req, "ACCESS_BADGE_GENERATED", "AccessBadge", badge.id, { eventId, categoryId: data.categoryId });
  res.status(StatusCodes.CREATED).json(jsonResponse({ status: "success", message: "Badge généré", data: badge }));
});

export const getBadges = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const badges = await accessService.getBadges(eventId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Badges récupérés", data: badges }));
});

export const sendBadge = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const badgeId = p(req.params.badgeId);
  const { userId, role } = req.user!;
  const badge = await accessService.sendBadgeByEmail(eventId, badgeId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Badge envoyé par email", data: badge }));
});

export const sendBadgeSms = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const badgeId = p(req.params.badgeId);
  const { userId, role } = req.user!;
  const { phone } = sendBadgeSmsSchema.parse(req.body);
  const result = await accessService.sendBadgeBySms(eventId, badgeId, userId, role, phone);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Badge envoye par SMS", data: result }));
});

export const revokeBadge = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const badgeId = p(req.params.badgeId);
  const { userId, role } = req.user!;
  const badge = await accessService.revokeBadge(eventId, badgeId, userId, role);
  await auditAccessAction(req, "ACCESS_BADGE_REVOKED", "AccessBadge", badgeId, { eventId });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Badge révoqué", data: badge }));
});

export const regenerateBadge = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const badgeId = p(req.params.badgeId);
  const { userId, role } = req.user!;
  const badge = await accessService.regenerateBadge(eventId, badgeId, userId, role);
  await auditAccessAction(req, "ACCESS_BADGE_REGENERATED", "AccessBadge", badgeId, { eventId });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Badge régénéré", data: badge }));
});

// ─── Badges indépendants (standalone) ────────────────────────────────

export const generateStandaloneBadge = controllerWrapper(async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const data = generateStandaloneBadgeSchema.parse(req.body);
  const badge = await accessService.generateStandaloneBadge(userId, data);
  await auditAccessAction(req, "ACCESS_STANDALONE_BADGE_GENERATED", "AccessBadge", badge.id, {});
  res.status(StatusCodes.CREATED).json(jsonResponse({ status: "success", message: "Badge indépendant créé", data: badge }));
});

export const getStandaloneBadges = controllerWrapper(async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const badges = await accessService.getStandaloneBadges(userId);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Badges récupérés", data: badges }));
});

export const revokeStandaloneBadge = controllerWrapper(async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const badgeId = String(req.params.badgeId);
  const badge = await accessService.revokeStandaloneBadge(badgeId, userId);
  await auditAccessAction(req, "ACCESS_STANDALONE_BADGE_REVOKED", "AccessBadge", badgeId, {});
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Badge révoqué", data: badge }));
});

export const sendStandaloneBadge = controllerWrapper(async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const badgeId = String(req.params.badgeId);
  const badge = await accessService.sendStandaloneBadgeByEmail(badgeId, userId);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Badge envoyé par email", data: badge }));
});

// ─── Scan ─────────────────────────────────────────────────────────────

export const scanBadge = controllerWrapper(async (req: Request, res: Response) => {
  const agentId = req.user!.userId;
  const data = scanSchema.parse(req.body);
  const result = await accessService.scanBadge(agentId, data);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Scan traité", data: result }));
});

export const syncOffline = controllerWrapper(async (req: Request, res: Response) => {
  const agentId = req.user!.userId;
  const { scans } = syncOfflineSchema.parse(req.body);
  const result = await accessService.syncOfflineScans(agentId, scans);
  await auditAccessAction(req, "ACCESS_OFFLINE_SYNC", "AccessLog", undefined, {
    synced: result.synced,
    scansReceived: scans.length,
  });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Synchronisation effectuée", data: result }));
});

export const verifyAgentCode = controllerWrapper(async (req: Request, res: Response) => {
  const { code } = verifyAgentCodeSchema.parse(req.body);
  const result = accessService.verifyAgentCode(code);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Code agent valide", data: result }));
});

// ─── Tracking & Reporting ─────────────────────────────────────────────

export const getTracking = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const tracking = await accessService.getTracking(eventId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Tracking récupéré", data: tracking }));
});

export const getAccessLogs = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const zoneId = req.query.zoneId ? p(req.query.zoneId) : undefined;
  const result = req.query.result as "granted" | "denied" | "conditional" | undefined;
  const logs = await accessService.getAccessLogs(eventId, userId, role, { zoneId, result });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Logs récupérés", data: logs }));
});

export const getRefusedAttempts = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const logs = await accessService.getRefusedAttempts(eventId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Tentatives refusées récupérées", data: logs }));
});

export const exportCsv = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const csv = await accessService.exportCsv(eventId, userId, role);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="access-report-${eventId}.csv"`);
  res.status(StatusCodes.OK).send(csv);
});

export const exportBadgesCsv = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const csv = await accessService.exportBadgesCsv(eventId, userId, role);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="access-badges-${eventId}.csv"`);
  res.status(StatusCodes.OK).send(csv);
});

export const duplicateConfig = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const { sourceEventId } = duplicateConfigSchema.parse(req.body);
  const result = await accessService.duplicateConfig(eventId, normalizeEventId(sourceEventId), userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Configuration dupliquee", data: result }));
});

export const getCurrentQr = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const badgeId = p(req.params.badgeId);
  const { userId, role } = req.user!;
  const result = await accessService.getCurrentQr(eventId, badgeId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "QR rotatif généré", data: result }));
});

// ─── Signalement ──────────────────────────────────────────────────────

export const reportSuspect = controllerWrapper(async (req: Request, res: Response) => {
  const badgeId = p(req.params.badgeId);
  const agentId = req.user!.userId;
  const { reason } = reportSuspectSchema.parse(req.body);
  const report = await accessService.reportSuspectBadge(badgeId, agentId, reason);
  await auditAccessAction(req, "ACCESS_SUSPECT_REPORTED", "AccessBadge", badgeId, { reason });
  res.status(StatusCodes.CREATED).json(jsonResponse({ status: "success", message: "Signalement enregistré", data: report }));
});

export const getSuspectReports = controllerWrapper(async (req: Request, res: Response) => {
  const eventId = p(req.params.eventId);
  const { userId, role } = req.user!;
  const reports = await accessService.getSuspectReports(eventId, userId, role);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Signalements récupérés", data: reports }));
});
