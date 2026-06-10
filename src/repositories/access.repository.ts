import { prisma } from "../config/database.js";
import type { ZoneAccessLevel, BadgeStatus, AccessResult } from "../generated/prisma/client.js";
import { firestoreSyncService } from "../services/firestore-sync.service.js";

// ─── Zones ────────────────────────────────────────────────────────────

export const accessRepository = {
  // ── Zones ────────────────────────────────────────────────────────────

  async createZone(data: {
    eventId: string;
    code: string;
    name: string;
    description?: string;
    color?: string;
    maxCapacity?: number;
  }) {
    return prisma.eventZone.create({ data });
  },

  async findZonesByEvent(eventId: string) {
    return prisma.eventZone.findMany({
      where: { eventId },
      include: { accessRights: { include: { category: true } } },
      orderBy: { code: "asc" },
    });
  },

  async findZoneById(id: string) {
    return prisma.eventZone.findUnique({
      where: { id },
      include: { accessRights: true },
    });
  },

  async findZoneByCode(eventId: string, code: string) {
    return prisma.eventZone.findUnique({ where: { eventId_code: { eventId, code } } });
  },

  async updateZone(id: string, data: Partial<{
    name: string;
    description: string;
    color: string;
    isActive: boolean;
    maxCapacity: number;
    currentCount: number;
  }>) {
    return prisma.eventZone.update({ where: { id }, data });
  },

  async deleteZone(id: string) {
    return prisma.eventZone.delete({ where: { id } });
  },

  async incrementZoneCount(zoneId: string, delta: number) {
    return prisma.eventZone.update({
      where: { id: zoneId },
      data: { currentCount: { increment: delta } },
    });
  },

  // ── Catégories ───────────────────────────────────────────────────────

  async createCategory(data: {
    eventId: string;
    name: string;
    description?: string;
    color?: string;
  }) {
    return prisma.participantCategory.create({ data });
  },

  async findCategoriesByEvent(eventId: string) {
    return prisma.participantCategory.findMany({
      where: { eventId },
      include: { accessRights: { include: { zone: true } } },
      orderBy: { name: "asc" },
    });
  },

  async findCategoryById(id: string) {
    return prisma.participantCategory.findUnique({
      where: { id },
      include: { accessRights: { include: { zone: true } } },
    });
  },

  async updateCategory(id: string, data: Partial<{ name: string; description: string; color: string }>) {
    return prisma.participantCategory.update({ where: { id }, data });
  },

  async deleteCategory(id: string) {
    return prisma.participantCategory.delete({ where: { id } });
  },

  // ── Droits d'accès ───────────────────────────────────────────────────

  async upsertAccessRight(categoryId: string, zoneId: string, accessLevel: ZoneAccessLevel) {
    return prisma.zoneAccessRight.upsert({
      where: { categoryId_zoneId: { categoryId, zoneId } },
      create: { categoryId, zoneId, accessLevel },
      update: { accessLevel },
    });
  },

  async bulkUpsertAccessRights(rights: { categoryId: string; zoneId: string; accessLevel: ZoneAccessLevel }[]) {
    return Promise.all(
      rights.map((r) =>
        prisma.zoneAccessRight.upsert({
          where: { categoryId_zoneId: { categoryId: r.categoryId, zoneId: r.zoneId } },
          create: r,
          update: { accessLevel: r.accessLevel },
        })
      )
    );
  },

  async getAccessRightsByCategory(categoryId: string) {
    return prisma.zoneAccessRight.findMany({
      where: { categoryId },
      include: { zone: true },
    });
  },

  async getAccessRight(categoryId: string, zoneId: string) {
    return prisma.zoneAccessRight.findUnique({
      where: { categoryId_zoneId: { categoryId, zoneId } },
    });
  },

  // ── Badges ───────────────────────────────────────────────────────────

  async createBadge(data: {
    eventId?: string | null;
    categoryId?: string | null;
    eventLabel?: string | null;
    categoryLabel?: string | null;
    createdById: string;
    ticketId?: string;
    holderName: string;
    holderEmail: string;
    holderPhone?: string;
    holderPhoto?: string;
    qrCode: string;
    qrSecret: string;
  }) {
    return prisma.accessBadge.create({
      data: data as any,
      include: { category: true, event: { select: { id: true, title: true } } },
    });
  },

  async findBadgeById(id: string) {
    return prisma.accessBadge.findUnique({
      where: { id },
      include: { category: { include: { accessRights: { include: { zone: true } } } }, event: { select: { id: true, title: true } } },
    });
  },

  async findBadgeByQrCode(qrCode: string) {
    return prisma.accessBadge.findUnique({
      where: { qrCode },
      include: { category: { include: { accessRights: { include: { zone: true } } } }, event: { select: { id: true, title: true } } },
    });
  },

  async findBadgesByEvent(eventId: string) {
    return prisma.accessBadge.findMany({
      where: { eventId },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async findStandaloneBadgesByCreator(createdById: string) {
    return prisma.accessBadge.findMany({
      where: { createdById, eventId: null },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async updateBadge(id: string, data: Partial<{
    status: BadgeStatus;
    sentAt: Date;
    revokedAt: Date | null;
    revokedById: string | null;
    qrCode: string;
    qrSecret: string;
    holderPhone: string;
    holderPhoto: string;
  }>) {
    return prisma.accessBadge.update({ where: { id }, data: data as any });
  },

  // ── Logs d'accès ─────────────────────────────────────────────────────

  async createAccessLog(data: {
    badgeId: string;
    zoneId: string;
    eventId: string;
    scannedById: string;
    result: AccessResult;
    refusalReason?: string;
    offlineSync?: boolean;
    scannedAt?: Date;
  }) {
    const created = await prisma.accessLog.create({ data });
    await firestoreSyncService.syncAccessLog({
      id: created.id,
      badgeId: created.badgeId,
      zoneId: created.zoneId,
      eventId: created.eventId,
      scannedById: created.scannedById,
      result: created.result,
      refusalReason: created.refusalReason,
      offlineSync: created.offlineSync,
      scannedAt: created.scannedAt,
    });
    return created;
  },

  async bulkCreateAccessLogs(logs: {
    badgeId: string;
    zoneId: string;
    eventId: string;
    scannedById: string;
    result: AccessResult;
    refusalReason?: string;
    offlineSync: boolean;
    scannedAt: Date;
  }[]) {
    const result = await prisma.accessLog.createMany({ data: logs });
    // Synchronisation best-effort des scans offline.
    await Promise.all(
      logs.map((log) =>
        firestoreSyncService.syncGeneric("access_logs", `${log.badgeId}_${log.zoneId}_${log.scannedAt.getTime()}`, {
          ...log,
          scannedAt: log.scannedAt.toISOString(),
        })
      )
    );
    return result;
  },

  async findLogsByEvent(eventId: string, filters?: { zoneId?: string; result?: AccessResult }) {
    return prisma.accessLog.findMany({
      where: { eventId, ...(filters?.zoneId && { zoneId: filters.zoneId }), ...(filters?.result && { result: filters.result }) },
      include: {
        badge: { select: { holderName: true, holderEmail: true, category: { select: { name: true } } } },
        zone: { select: { name: true, code: true } },
      },
      orderBy: { scannedAt: "desc" },
    });
  },

  async countLogsByZone(eventId: string) {
    return prisma.accessLog.groupBy({
      by: ["zoneId"],
      where: { eventId, result: "granted" },
      _count: { _all: true },
    });
  },

  async countGrantedLogsByZoneIds(zoneIds: string[]) {
    return prisma.accessLog.groupBy({
      by: ["zoneId"],
      where: { zoneId: { in: zoneIds }, result: "granted" },
      _count: { _all: true },
    });
  },

  async findEventAccessConfig(eventId: string) {
    const [zones, categories] = await Promise.all([
      prisma.eventZone.findMany({ where: { eventId }, orderBy: { code: "asc" } }),
      prisma.participantCategory.findMany({
        where: { eventId },
        include: { accessRights: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { zones, categories };
  },

  // ── Signalements suspects ─────────────────────────────────────────────

  async createSuspectReport(data: { badgeId: string; reportedById: string; reason: string }) {
    return prisma.suspectBadgeReport.create({ data });
  },

  async findSuspectReportsByEvent(eventId: string) {
    return prisma.suspectBadgeReport.findMany({
      where: { badge: { eventId } },
      include: { badge: { select: { holderName: true, holderEmail: true, category: true } } },
      orderBy: { createdAt: "desc" },
    });
  },
};
