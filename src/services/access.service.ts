import { StatusCodes } from "http-status-codes";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { AppError } from "../utils/AppError.js";
import { accessRepository } from "../repositories/access.repository.js";
import { eventRepository } from "../repositories/event.repository.js";
import { eventControllerRepository } from "../repositories/eventController.repository.js";
import { prisma } from "../config/database.js";
import { feetiPlaySyncService } from "./feetiPlaySync.service.js";
import { firestoreSyncService } from "./firestore-sync.service.js";
import { addEmailJob } from "../queues/email.queue.js";
import { smsService } from "./sms.service.js";
import { getIO } from "../config/socket.js";
import type { ZoneAccessLevel } from "../generated/prisma/client.js";

const BADGE_SECRET = process.env.BADGE_SECRET || "feeti-access-badge-secret";
const AGENT_CODE = process.env.FEETI_ACCESS_AGENT_CODE || "FEETI-AGENT";
const FEETIPLAY_LIVE_ID_PREFIX = "feeti2_live_";

// ─── Templates de zones prédéfinies ────────────────────────────────────────

export const ZONE_TEMPLATES = [
  { code: "Z1",  name: "Accès Général",          description: "Entrée principale, sortie, zone publique", color: "#22C55E" },
  { code: "Z2",  name: "Contrôle Billets",        description: "Point de scan entrée, pré-filtrage",       color: "#F59E0B" },
  { code: "Z3",  name: "Zone Publique Étendue",   description: "Stands, food court, sponsors, animations", color: "#3B82F6" },
  { code: "Z4",  name: "Zone Scène",              description: "Devant scène — semi-restrictive",           color: "#8B5CF6" },
  { code: "Z5",  name: "VIP",                     description: "Espace VIP, loges VIP, lounge",            color: "#F97316" },
  { code: "Z6",  name: "Backstage",               description: "Derrière scène, loges artistes, production", color: "#EF4444" },
  { code: "Z7",  name: "Média / Presse",          description: "Zone interview, zone captation",            color: "#06B6D4" },
  { code: "Z8",  name: "Zone Technique",          description: "Régie son/lumière, zone équipements",       color: "#6B7280" },
  { code: "Z9",  name: "Sécurité / Staff",        description: "Poste de commandement, accès surveillance", color: "#1F2937" },
  { code: "Z10", name: "Logistique",              description: "Parking staff, accès livraison, montage",   color: "#92400E" },
] as const;

// Matrice d'accès par défaut (document section 3C)
// Clé: nom_catégorie, Valeur: map code_zone → niveau
const DEFAULT_ACCESS_MATRIX: Record<string, Record<string, ZoneAccessLevel>> = {
  "Public Standard":     { Z1:"OUI",  Z2:"NON",  Z3:"OUI",  Z4:"NON",  Z5:"NON",  Z6:"NON",  Z7:"NON",  Z8:"NON",  Z9:"NON",  Z10:"NON" },
  "VIP":                 { Z1:"OUI",  Z2:"OUI",  Z3:"OUI",  Z4:"COND", Z5:"OUI",  Z6:"NON",  Z7:"NON",  Z8:"NON",  Z9:"NON",  Z10:"NON" },
  "VVIP / Invités spéciaux": { Z1:"OUI",  Z2:"OUI",  Z3:"OUI",  Z4:"OUI",  Z5:"OUI",  Z6:"COND", Z7:"NON",  Z8:"NON",  Z9:"NON",  Z10:"NON" },
  "Artistes":            { Z1:"COND", Z2:"OUI",  Z3:"OUI",  Z4:"OUI",  Z5:"OUI",  Z6:"OUI",  Z7:"NON",  Z8:"NON",  Z9:"NON",  Z10:"NON" },
  "Staff Organisateur":  { Z1:"OUI",  Z2:"COND", Z3:"OUI",  Z4:"COND", Z5:"COND", Z6:"COND", Z7:"NON",  Z8:"COND", Z9:"COND", Z10:"COND" },
  "Média / Presse":      { Z1:"OUI",  Z2:"OUI",  Z3:"OUI",  Z4:"COND", Z5:"COND", Z6:"NON",  Z7:"OUI",  Z8:"NON",  Z9:"NON",  Z10:"NON" },
  "Équipe Technique":    { Z1:"NON",  Z2:"NON",  Z3:"NON",  Z4:"COND", Z5:"NON",  Z6:"OUI",  Z7:"NON",  Z8:"OUI",  Z9:"NON",  Z10:"COND" },
  "Sécurité":            { Z1:"OUI",  Z2:"OUI",  Z3:"OUI",  Z4:"OUI",  Z5:"OUI",  Z6:"OUI",  Z7:"OUI",  Z8:"OUI",  Z9:"OUI",  Z10:"OUI" },
  "Partenaires / Sponsors": { Z1:"OUI",  Z2:"OUI",  Z3:"OUI",  Z4:"NON",  Z5:"OUI",  Z6:"NON",  Z7:"NON",  Z8:"NON",  Z9:"NON",  Z10:"NON" },
  "Logistique":          { Z1:"NON",  Z2:"NON",  Z3:"NON",  Z4:"NON",  Z5:"NON",  Z6:"COND", Z7:"NON",  Z8:"COND", Z9:"NON",  Z10:"OUI" },
};

// ─── Helpers QR ────────────────────────────────────────────────────────────

type BadgeQrPayload = {
  badgeId: string;
  eventId: string;
  categoryId: string;
  categoryName: string;
  holderName: string;
  holderEmail: string;
  holderPhone?: string;
  holderPhoto?: string;
  authorizedZones: { zoneId: string; zoneCode: string; zoneName: string; level: ZoneAccessLevel }[];
  issuedAt: number;
};

function b64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64");
}

function encryptionKey(secret: string): Buffer {
  return createHash("sha256").update(BADGE_SECRET).update(secret).digest();
}

function encryptPayload(payload: BadgeQrPayload, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ v: 2, alg: "A256GCM", bid: payload.badgeId, iv: b64url(iv), tag: b64url(tag), data: b64url(ciphertext) });
}

function decryptPayload(qrCode: string, secret: string): BadgeQrPayload | null {
  try {
    const envelope = JSON.parse(qrCode);
    if (envelope?.v !== 2 || envelope?.alg !== "A256GCM") return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), fromB64url(envelope.iv));
    decipher.setAuthTag(fromB64url(envelope.tag));
    const decrypted = Buffer.concat([decipher.update(fromB64url(envelope.data)), decipher.final()]).toString("utf8");
    return JSON.parse(decrypted) as BadgeQrPayload;
  } catch {
    return null;
  }
}

function generateQrPayload(payload: BadgeQrPayload, secret: string): string {
  return encryptPayload(payload, secret);
}

function generateLegacyQrPayload(badgeId: string, eventId: string, categoryId: string, secret: string): string {
  const issuedAt = Date.now();
  const payload = JSON.stringify({ badgeId, eventId, categoryId, issuedAt });
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return JSON.stringify({ badgeId, eventId, categoryId, issuedAt, sig });
}

function verifyQrPayload(qrCode: string, secret: string): { badgeId: string; eventId: string; categoryId: string } | null {
  try {
    const encrypted = decryptPayload(qrCode, secret);
    if (encrypted) return {
      badgeId: encrypted.badgeId,
      eventId: encrypted.eventId,
      categoryId: encrypted.categoryId,
    };

    const { badgeId, eventId, categoryId, issuedAt, sig } = JSON.parse(qrCode);
    const payload = JSON.stringify({ badgeId, eventId, categoryId, issuedAt });
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (sig !== expected) return null;
    return { badgeId, eventId, categoryId };
  } catch {
    return null;
  }
}

function buildBadgePayload(badge: {
  id: string;
  eventId: string;
  categoryId: string;
  holderName: string;
  holderEmail: string;
  holderPhone?: string | null;
  holderPhoto?: string | null;
  category: { name: string; accessRights?: { zoneId: string; accessLevel: ZoneAccessLevel; zone: { code: string; name: string } }[] };
}): BadgeQrPayload {
  return {
    badgeId: badge.id,
    eventId: badge.eventId,
    categoryId: badge.categoryId,
    categoryName: badge.category.name,
    holderName: badge.holderName,
    holderEmail: badge.holderEmail,
    ...(badge.holderPhone ? { holderPhone: badge.holderPhone } : {}),
    ...(badge.holderPhoto ? { holderPhoto: badge.holderPhoto } : {}),
    authorizedZones: (badge.category.accessRights ?? [])
      .filter((r) => r.accessLevel !== "NON")
      .map((r) => ({ zoneId: r.zoneId, zoneCode: r.zone.code, zoneName: r.zone.name, level: r.accessLevel })),
    issuedAt: Date.now(),
  };
}

function assertAgentCode(code?: string) {
  if (code !== AGENT_CODE) {
    throw new AppError("Code agent invalide", StatusCodes.UNAUTHORIZED);
  }
}


// ─── Helpers permissions ────────────────────────────────────────────────────

async function assertOrganizerOrAdmin(eventId: string, userId: string, role: string) {
  let event = await eventRepository.findById(eventId);
  if (!event) {
    // Migration auto: ancien événement mixte stocké uniquement côté live FeetiPlay.
    const syncedId = eventId.startsWith(FEETIPLAY_LIVE_ID_PREFIX)
      ? eventId
      : `${FEETIPLAY_LIVE_ID_PREFIX}${eventId}`;
    const liveEvent = await feetiPlaySyncService.getLiveEventById(syncedId).catch(() => null);
    if (liveEvent) {
      try {
        await eventRepository.create({
          id: eventId,
          title: liveEvent.title,
          description: liveEvent.description,
          date: liveEvent.date,
          time: liveEvent.time,
          location: liveEvent.location,
          image: liveEvent.image,
          price: liveEvent.price,
          currency: liveEvent.currency,
          category: liveEvent.category,
          eventType: "MIXTE",
          maxAttendees: 1000,
          duration: liveEvent.duration,
          isLive: true,
          streamUrl: liveEvent.streamUrl ?? undefined,
          videoUrl: liveEvent.videoUrl ?? undefined,
          organizerId: liveEvent.organizerId,
        });
        event = await eventRepository.findById(eventId);
        if (event) await firestoreSyncService.syncEvent(event).catch(() => {});
      } catch {
        event = await eventRepository.findById(eventId);
      }
    }
  }
  if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
  const isAdmin = role === "admin" || role === "super_admin";
  if (!isAdmin && event.organizerId !== userId) {
    throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
  }
  return event;
}

// ─── Service ───────────────────────────────────────────────────────────────

export const accessService = {

  // ── ZONES ──────────────────────────────────────────────────────────────

  async createZone(eventId: string, userId: string, role: string, data: {
    code: string;
    name: string;
    description?: string;
    color?: string;
    maxCapacity?: number;
  }) {
    await assertOrganizerOrAdmin(eventId, userId, role);

    if (!/^Z\d+$/.test(data.code)) {
      throw new AppError(`Code zone invalide. Format attendu : Z suivi d'un numéro (ex: Z1, Z11)`, StatusCodes.BAD_REQUEST);
    }

    const existing = await accessRepository.findZoneByCode(eventId, data.code);
    if (existing) throw new AppError(`La zone ${data.code} existe déjà pour cet événement`, StatusCodes.CONFLICT);

    return accessRepository.createZone({ eventId, ...data });
  },

  async applyDefaultZones(eventId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);

    const existing = await accessRepository.findZonesByEvent(eventId);
    const existingCodes = new Set(existing.map((z) => z.code));

    const toCreate = ZONE_TEMPLATES.filter((t) => !existingCodes.has(t.code));
    await Promise.all(
      toCreate.map((t) => accessRepository.createZone({ eventId, ...t }))
    );

    return accessRepository.findZonesByEvent(eventId);
  },

  async getZones(eventId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    return accessRepository.findZonesByEvent(eventId);
  },

  async updateZone(eventId: string, zoneId: string, userId: string, role: string, data: {
    name?: string;
    description?: string;
    color?: string;
    isActive?: boolean;
    maxCapacity?: number;
  }) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    const zone = await accessRepository.findZoneById(zoneId);
    if (!zone || zone.eventId !== eventId) throw new AppError("Zone introuvable", StatusCodes.NOT_FOUND);
    return accessRepository.updateZone(zoneId, data);
  },

  async deleteZone(eventId: string, zoneId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    const zone = await accessRepository.findZoneById(zoneId);
    if (!zone || zone.eventId !== eventId) throw new AppError("Zone introuvable", StatusCodes.NOT_FOUND);
    return accessRepository.deleteZone(zoneId);
  },

  // ── CATÉGORIES ──────────────────────────────────────────────────────────

  async createCategory(eventId: string, userId: string, role: string, data: {
    name: string;
    description?: string;
    color?: string;
  }) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    return accessRepository.createCategory({ eventId, ...data });
  },

  async applyDefaultCategories(eventId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);

    const defaults = Object.keys(DEFAULT_ACCESS_MATRIX);
    const existing = await accessRepository.findCategoriesByEvent(eventId);
    const existingNames = new Set(existing.map((c) => c.name));

    await Promise.all(
      defaults
        .filter((name) => !existingNames.has(name))
        .map((name) => accessRepository.createCategory({ eventId, name }))
    );

    return accessRepository.findCategoriesByEvent(eventId);
  },

  async getCategories(eventId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    return accessRepository.findCategoriesByEvent(eventId);
  },

  async updateCategory(eventId: string, categoryId: string, userId: string, role: string, data: {
    name?: string;
    description?: string;
    color?: string;
  }) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    const cat = await accessRepository.findCategoryById(categoryId);
    if (!cat || cat.eventId !== eventId) throw new AppError("Catégorie introuvable", StatusCodes.NOT_FOUND);
    return accessRepository.updateCategory(categoryId, data);
  },

  async deleteCategory(eventId: string, categoryId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    const cat = await accessRepository.findCategoryById(categoryId);
    if (!cat || cat.eventId !== eventId) throw new AppError("Catégorie introuvable", StatusCodes.NOT_FOUND);
    return accessRepository.deleteCategory(categoryId);
  },

  // ── DROITS D'ACCÈS ──────────────────────────────────────────────────────

  async setAccessRights(eventId: string, userId: string, role: string, rights: {
    categoryId: string;
    zoneId: string;
    accessLevel: ZoneAccessLevel;
  }[]) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    return accessRepository.bulkUpsertAccessRights(rights);
  },

  async applyDefaultMatrix(eventId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);

    const [zones, categories] = await Promise.all([
      accessRepository.findZonesByEvent(eventId),
      accessRepository.findCategoriesByEvent(eventId),
    ]);

    if (zones.length === 0 || categories.length === 0) {
      throw new AppError(
        "Créez d'abord des zones et des catégories (ou utilisez /apply-defaults)",
        StatusCodes.BAD_REQUEST
      );
    }

    const zoneByCode = Object.fromEntries(zones.map((z) => [z.code, z]));
    const rights: { categoryId: string; zoneId: string; accessLevel: ZoneAccessLevel }[] = [];

    for (const cat of categories) {
      const matrix = DEFAULT_ACCESS_MATRIX[cat.name];
      if (!matrix) continue;
      for (const [code, level] of Object.entries(matrix)) {
        const zone = zoneByCode[code];
        if (zone) rights.push({ categoryId: cat.id, zoneId: zone.id, accessLevel: level as ZoneAccessLevel });
      }
    }

    if (rights.length === 0) throw new AppError("Aucune correspondance avec la matrice par défaut", StatusCodes.BAD_REQUEST);

    await accessRepository.bulkUpsertAccessRights(rights);
    return { applied: rights.length };
  },

  async getAccessMatrix(eventId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    const [zones, categories] = await Promise.all([
      accessRepository.findZonesByEvent(eventId),
      accessRepository.findCategoriesByEvent(eventId),
    ]);
    return { zones, categories };
  },

  // ── BADGES ──────────────────────────────────────────────────────────────

  async generateBadge(eventId: string, userId: string, role: string, data: {
    categoryId: string;
    holderName: string;
    holderEmail: string;
    holderPhone?: string;
    holderPhoto?: string;
    ticketId?: string;
  }) {
    await assertOrganizerOrAdmin(eventId, userId, role);

    const cat = await accessRepository.findCategoryById(data.categoryId);
    if (!cat || cat.eventId !== eventId) throw new AppError("Catégorie introuvable", StatusCodes.NOT_FOUND);

    const badgeId = randomUUID();
    const secret = randomUUID();
    const qrCode = generateLegacyQrPayload(badgeId, eventId, data.categoryId, secret);

    const badge = await accessRepository.createBadge({
      eventId,
      categoryId: data.categoryId,
      holderName: data.holderName,
      holderEmail: data.holderEmail,
      createdById: userId,
      ...(data.holderPhone && { holderPhone: data.holderPhone }),
      ...(data.holderPhoto && { holderPhoto: data.holderPhoto }),
      qrCode,
      qrSecret: secret,
      ...(data.ticketId && { ticketId: data.ticketId }),
    });

    // Patch l'id réel dans le QR (on recalcule avec l'id Prisma généré)
    const hydrated = await accessRepository.findBadgeById(badge.id);
    if (!hydrated) throw new AppError("Badge introuvable apres creation", StatusCodes.INTERNAL_SERVER_ERROR);
    const finalQr = generateQrPayload(buildBadgePayload(hydrated as any), secret);
    return accessRepository.updateBadge(badge.id, { qrCode: finalQr });
  },

  async getBadges(eventId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    return accessRepository.findBadgesByEvent(eventId);
  },

  // ── Badges indépendants (sans événement obligatoire) ──────────────────

  async generateStandaloneBadge(userId: string, data: {
    holderName: string;
    holderEmail: string;
    holderPhone?: string;
    holderPhoto?: string;
    categoryLabel: string;
    eventLabel?: string;
    eventId?: string;
  }) {
    // Vérifier que l'eventId fourni appartient bien à l'organisateur si précisé
    if (data.eventId) {
      const event = await prisma.event.findUnique({ where: { id: data.eventId }, select: { organizerId: true } });
      if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
      if (event.organizerId !== userId) throw new AppError("Vous n'êtes pas l'organisateur de cet événement", StatusCodes.FORBIDDEN);
    }

    const badgeId = randomUUID();
    const secret = randomUUID();
    // QR sans zone ni catégorie Prisma — payload simple
    const qrPayload = JSON.stringify({ t: "standalone", b: badgeId, s: secret.slice(0, 8) });

    const badge = await accessRepository.createBadge({
      eventId: data.eventId ?? null,
      categoryId: null,
      categoryLabel: data.categoryLabel,
      eventLabel: data.eventLabel ?? null,
      createdById: userId,
      holderName: data.holderName,
      holderEmail: data.holderEmail,
      ...(data.holderPhone && { holderPhone: data.holderPhone }),
      ...(data.holderPhoto && { holderPhoto: data.holderPhoto }),
      qrCode: qrPayload,
      qrSecret: secret,
    });

    return badge;
  },

  async getStandaloneBadges(userId: string) {
    return accessRepository.findStandaloneBadgesByCreator(userId);
  },

  async revokeStandaloneBadge(badgeId: string, userId: string) {
    const badge = await accessRepository.findBadgeById(badgeId);
    if (!badge) throw new AppError("Badge introuvable", StatusCodes.NOT_FOUND);
    if ((badge as any).createdById !== userId) throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
    if (badge.status === "revoked") throw new AppError("Badge déjà révoqué", StatusCodes.BAD_REQUEST);
    return accessRepository.updateBadge(badgeId, { status: "revoked", revokedAt: new Date(), revokedById: userId });
  },

  async sendStandaloneBadgeByEmail(badgeId: string, userId: string) {
    const badge = await accessRepository.findBadgeById(badgeId);
    if (!badge) throw new AppError("Badge introuvable", StatusCodes.NOT_FOUND);
    if ((badge as any).createdById !== userId) throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
    if (badge.status === "revoked") throw new AppError("Badge révoqué", StatusCodes.BAD_REQUEST);

    const eventTitle = (badge as any).eventLabel ?? (badge as any).event?.title ?? "Feeti Access";
    const categoryName = (badge as any).categoryLabel ?? (badge as any).category?.name ?? "Participant";

    await addEmailJob({
      type: "generic",
      to: badge.holderEmail,
      subject: `Votre badge d'accès — ${eventTitle}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>Votre badge Feeti Access</h2>
        <p>Bonjour <strong>${badge.holderName}</strong>,</p>
        <p>Voici votre badge d'accès pour : <strong>${eventTitle}</strong>.</p>
        <p><strong>Catégorie :</strong> ${categoryName}</p>
        <p>Présentez le QR code ci-dessous à l'entrée :</p>
        <div style="background:#f5f5f5;padding:16px;border-radius:8px;word-break:break-all;font-size:12px">
          ${badge.qrCode}
        </div>
        <p style="color:#888;font-size:12px">Ce badge est personnel et non transférable.</p>
      </div>`,
    });
    return accessRepository.updateBadge(badgeId, { sentAt: new Date() });
  },

  async sendBadgeByEmail(eventId: string, badgeId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    const badge = await accessRepository.findBadgeById(badgeId);
    if (!badge || badge.eventId !== eventId) throw new AppError("Badge introuvable", StatusCodes.NOT_FOUND);
    if (badge.status === "revoked") throw new AppError("Badge révoqué", StatusCodes.BAD_REQUEST);

    await addEmailJob({
      type: "generic",
      to: badge.holderEmail,
      subject: `Votre badge d'accès — ${badge.event!.title}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>Votre badge Feeti Access</h2>
        <p>Bonjour <strong>${badge.holderName}</strong>,</p>
        <p>Voici votre badge d'accès pour l'événement <strong>${badge.event!.title}</strong>.</p>
        <p><strong>Catégorie :</strong> ${badge.category!.name}</p>
        <p>Présentez le QR code ci-dessous à l'entrée de chaque zone :</p>
        <div style="background:#f5f5f5;padding:16px;border-radius:8px;word-break:break-all;font-size:12px">
          ${badge.qrCode}
        </div>
        <p style="color:#888;font-size:12px">Ce badge est personnel et non transférable.</p>
      </div>`,
    });

    return accessRepository.updateBadge(badgeId, { sentAt: new Date() });
  },

  async sendBadgeBySms(eventId: string, badgeId: string, userId: string, role: string, phone?: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    const badge = await accessRepository.findBadgeById(badgeId);
    if (!badge || badge.eventId !== eventId) throw new AppError("Badge introuvable", StatusCodes.NOT_FOUND);
    if (badge.status === "revoked") throw new AppError("Badge revoque", StatusCodes.BAD_REQUEST);

    const target = phone || (badge as any).holderPhone;
    if (!target) throw new AppError("Numero de telephone manquant", StatusCodes.BAD_REQUEST);

    const result = await smsService.send(
      target,
      `Feeti Access - ${badge.event!.title}: badge ${badge.holderName}, categorie ${badge.category!.name}. QR: ${badge.qrCode}`
    );

    return { badgeId: badge.id, phone: target, ...result };
  },

  async revokeBadge(eventId: string, badgeId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    const badge = await accessRepository.findBadgeById(badgeId);
    if (!badge || badge.eventId !== eventId) throw new AppError("Badge introuvable", StatusCodes.NOT_FOUND);
    if (badge.status === "revoked") throw new AppError("Badge déjà révoqué", StatusCodes.BAD_REQUEST);
    return accessRepository.updateBadge(badgeId, { status: "revoked", revokedAt: new Date(), revokedById: userId });
  },

  async regenerateBadge(eventId: string, badgeId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    const badge = await accessRepository.findBadgeById(badgeId);
    if (!badge || badge.eventId !== eventId) throw new AppError("Badge introuvable", StatusCodes.NOT_FOUND);

    const newSecret = randomUUID();
    const newQr = generateQrPayload(buildBadgePayload(badge as any), newSecret);
    return accessRepository.updateBadge(badgeId, { qrCode: newQr, qrSecret: newSecret, status: "active" });
  },

  // ── SCAN ────────────────────────────────────────────────────────────────

  async scanBadge(agentId: string, agentRole: string, data: { qrCode: string; zoneId: string; agentCode?: string }) {
    assertAgentCode(data.agentCode);
    // 1. Parser le QR pour extraire badgeId
    let parsedBadgeId: string | null = null;
    try {
      const raw = JSON.parse(data.qrCode);
      parsedBadgeId = typeof raw.badgeId === "string" ? raw.badgeId : typeof raw.bid === "string" ? raw.bid : null;
    } catch {
      return { result: "denied" as const, refusalReason: "QR code invalide" };
    }

    if (!parsedBadgeId) {
      return { result: "denied" as const, refusalReason: "QR code invalide" };
    }

    // 2. Récupérer le badge par ID
    const badgeRaw = await accessRepository.findBadgeById(parsedBadgeId);
    if (!badgeRaw) {
      return { result: "denied" as const, refusalReason: "Badge introuvable" };
    }
    if (!badgeRaw.eventId || !badgeRaw.categoryId || !badgeRaw.category) {
      return { result: "denied" as const, refusalReason: "Badge invalide" };
    }
    const bEventId = badgeRaw.eventId;
    const bCategoryId = badgeRaw.categoryId;
    const bCategory = badgeRaw.category;

    // 2b. Vérifier que l'agent est autorisé à scanner pour cet événement
    const isAdmin = agentRole === "admin" || agentRole === "super_admin";
    if (!isAdmin) {
      const event = await eventRepository.findById(bEventId);
      const isOrganizer = agentRole === "organizer" && event?.organizerId === agentId;
      if (!isOrganizer) {
        const assigned = await eventControllerRepository.isAssigned(bEventId, agentId);
        if (!assigned) {
          return { result: "denied" as const, refusalReason: "Vous n'êtes pas autorisé à scanner pour cet événement" };
        }
      }
    }

    // 3. Vérifier la signature (format statique uniquement)
    if (badgeRaw.qrCode !== data.qrCode) {
      await accessRepository.createAccessLog({
        badgeId: badgeRaw.id, zoneId: data.zoneId, eventId: bEventId,
        scannedById: agentId, result: "denied", refusalReason: "QR code invalide",
      });
      return { result: "denied" as const, refusalReason: "QR code invalide" };
    }
    if (!verifyQrPayload(data.qrCode, badgeRaw.qrSecret)) {
      await accessRepository.createAccessLog({
        badgeId: badgeRaw.id, zoneId: data.zoneId, eventId: bEventId,
        scannedById: agentId, result: "denied", refusalReason: "Signature QR invalide",
      });
      return { result: "denied" as const, refusalReason: "Signature QR invalide" };
    }

    // 4. Vérifier le statut du badge
    if (badgeRaw.status === "revoked") {
      await accessRepository.createAccessLog({
        badgeId: badgeRaw.id, zoneId: data.zoneId, eventId: bEventId,
        scannedById: agentId, result: "denied", refusalReason: "Badge révoqué",
      });
      return { result: "denied" as const, refusalReason: "Badge révoqué", holder: { name: badgeRaw.holderName, badgeId: badgeRaw.id, photo: (badgeRaw as any).holderPhoto } };
    }

    if (badgeRaw.status === "expired") {
      await accessRepository.createAccessLog({
        badgeId: badgeRaw.id, zoneId: data.zoneId, eventId: bEventId,
        scannedById: agentId, result: "denied", refusalReason: "Badge expiré",
      });
      return { result: "denied" as const, refusalReason: "Badge expiré", holder: { name: badgeRaw.holderName, badgeId: badgeRaw.id, photo: (badgeRaw as any).holderPhoto } };
    }

    // 5. Vérifier le droit d'accès pour cette zone
    const right = await accessRepository.getAccessRight(bCategoryId, data.zoneId);
    const level = right?.accessLevel ?? "NON";

    let result: "granted" | "denied" | "conditional";
    let refusalReason: string | undefined;

    if (level === "OUI") {
      result = "granted";
      await accessRepository.incrementZoneCount(data.zoneId, 1);
    } else if (level === "COND") {
      result = "conditional";
    } else {
      result = "denied";
      refusalReason = `Accès non autorisé pour la catégorie "${bCategory.name}" dans cette zone`;
    }

    await accessRepository.createAccessLog({
      badgeId: badgeRaw.id, zoneId: data.zoneId, eventId: bEventId,
      scannedById: agentId, result,
      ...(refusalReason && { refusalReason }),
    });

    // 6. Émettre la mise à jour de zone via WebSocket
    if (result === "granted") {
      try {
        const zone = await accessRepository.findZoneById(data.zoneId);
        if (zone) {
          const logCounts = await accessRepository.countLogsByZone(bEventId);
          const countMap = Object.fromEntries(logCounts.map((c) => [c.zoneId, c._count._all]));
          getIO().to(`event:${bEventId}`).emit("zone:update", {
            zoneId: zone.id, code: zone.code, name: zone.name, color: zone.color,
            currentCount: zone.currentCount,
            totalEntries: countMap[zone.id] ?? 0,
            maxCapacity: zone.maxCapacity,
            isOverCapacity: zone.maxCapacity != null && zone.currentCount > zone.maxCapacity,
          });
        }
      } catch { /* socket non initialisé ou erreur non bloquante */ }
    }

    // 7. Droits de la catégorie sur toutes les zones (affichage agent)
    const allRights = await accessRepository.getAccessRightsByCategory(bCategoryId);

    return {
      result,
      refusalReason,
      holder: {
        name: badgeRaw.holderName,
        badgeId: badgeRaw.id,
        email: badgeRaw.holderEmail,
        phone: (badgeRaw as any).holderPhone,
        photo: (badgeRaw as any).holderPhoto,
        category: bCategory.name,
        authorizedZones: allRights
          .filter((r) => r.accessLevel === "OUI" || r.accessLevel === "COND")
          .map((r) => ({ zoneId: r.zoneId, zoneName: r.zone.name, level: r.accessLevel })),
      },
    };
  },

  async syncOfflineScans(agentId: string, scans: {
    qrCode: string;
    zoneId: string;
    scannedAt: string;
  }[]) {
    const logs: Parameters<typeof accessRepository.bulkCreateAccessLogs>[0] = [];

    for (const scan of scans) {
      // Extraire badgeId du payload JSON (supporte format statique et rotatif)
      let badgeId: string | null = null;
      try {
        const raw = JSON.parse(scan.qrCode);
        badgeId = typeof raw.badgeId === "string" ? raw.badgeId : null;
      } catch { continue; }
      if (!badgeId) continue;

      const badge = await accessRepository.findBadgeById(badgeId);
      if (!badge || !badge.eventId || !badge.categoryId || !badge.category) continue;

      // Pour les scans offline on bypasse la vérification de fenêtre temporelle
      const right = await accessRepository.getAccessRight(badge.categoryId, scan.zoneId);
      const level = right?.accessLevel ?? "NON";
      const result = level === "OUI" ? "granted" : level === "COND" ? "conditional" : "denied";
      const refusalReason = result === "denied"
        ? `Accès non autorisé pour la catégorie "${badge.category.name}"`
        : undefined;

      logs.push({
        badgeId: badge.id, zoneId: scan.zoneId, eventId: badge.eventId,
        scannedById: agentId, result, offlineSync: true,
        scannedAt: new Date(scan.scannedAt),
        ...(refusalReason && { refusalReason }),
      });
    }

    await accessRepository.bulkCreateAccessLogs(logs);
    const grantedByZone = new Map<string, number>();
    for (const log of logs) {
      if (log.result === "granted") grantedByZone.set(log.zoneId, (grantedByZone.get(log.zoneId) ?? 0) + 1);
    }
    await Promise.all([...grantedByZone.entries()].map(([zoneId, count]) => accessRepository.incrementZoneCount(zoneId, count)));
    return { synced: logs.length };
  },

  // ── TRACKING & REPORTING ─────────────────────────────────────────────────

  async getTracking(eventId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    const zones = await accessRepository.findZonesByEvent(eventId);
    const counts = await accessRepository.countLogsByZone(eventId);
    const countMap = Object.fromEntries(counts.map((c) => [c.zoneId, c._count._all]));

    return zones
      .filter((z) => z.isActive)
      .map((z) => ({
        zoneId: z.id,
        code: z.code,
        name: z.name,
        color: z.color,
        currentCount: z.currentCount,
        totalEntries: countMap[z.id] ?? 0,
        maxCapacity: z.maxCapacity,
        isOverCapacity: z.maxCapacity != null && z.currentCount > z.maxCapacity,
      }));
  },

  async getAccessLogs(eventId: string, userId: string, role: string, filters?: {
    zoneId?: string;
    result?: "granted" | "denied" | "conditional";
  }) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    return accessRepository.findLogsByEvent(eventId, filters);
  },

  async getRefusedAttempts(eventId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    return accessRepository.findLogsByEvent(eventId, { result: "denied" });
  },

  async exportCsv(eventId: string, userId: string, role: string): Promise<string> {
    await assertOrganizerOrAdmin(eventId, userId, role);
    const logs = await accessRepository.findLogsByEvent(eventId);

    const header = "badgeId,holderName,holderEmail,category,zone,result,refusalReason,offlineSync,scannedAt";
    const rows = logs.map((l) => [
      l.badgeId,
      l.badge.holderName,
      l.badge.holderEmail,
      l.badge.category?.name ?? "",
      `${l.zone.code} - ${l.zone.name}`,
      l.result,
      l.refusalReason ?? "",
      l.offlineSync ? "oui" : "non",
      l.scannedAt.toISOString(),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

    return [header, ...rows].join("\n");
  },

  // ── SIGNALEMENT SUSPECT ──────────────────────────────────────────────────

  async exportBadgesCsv(eventId: string, userId: string, role: string): Promise<string> {
    await assertOrganizerOrAdmin(eventId, userId, role);
    const badges = await accessRepository.findBadgesByEvent(eventId);
    const header = "badgeId,holderName,holderEmail,holderPhone,category,status,sentAt,qrCode";
    const rows = badges.map((b: any) => [
      b.id,
      b.holderName,
      b.holderEmail,
      b.holderPhone ?? "",
      b.category?.name ?? "",
      b.status,
      b.sentAt?.toISOString?.() ?? "",
      b.qrCode,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    return [header, ...rows].join("\n");
  },

  async duplicateConfig(eventId: string, sourceEventId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    await assertOrganizerOrAdmin(sourceEventId, userId, role);

    const [source, target] = await Promise.all([
      accessRepository.findEventAccessConfig(sourceEventId),
      accessRepository.findEventAccessConfig(eventId),
    ]);

    const targetZoneCodes = new Set(target.zones.map((z) => z.code));
    const createdZones = await Promise.all(
      source.zones
        .filter((z) => !targetZoneCodes.has(z.code))
        .map((z) => accessRepository.createZone({
          eventId,
          code: z.code,
          name: z.name,
          ...(z.description && { description: z.description }),
          color: z.color,
          ...(z.maxCapacity != null && { maxCapacity: z.maxCapacity }),
        }))
    );

    const freshZones = [...target.zones, ...createdZones];
    const zoneBySourceId = new Map(source.zones.map((sourceZone) => [
      sourceZone.id,
      freshZones.find((targetZone) => targetZone.code === sourceZone.code)?.id,
    ]));

    const targetCategoryNames = new Set(target.categories.map((c) => c.name));
    const createdCategories = await Promise.all(
      source.categories
        .filter((c) => !targetCategoryNames.has(c.name))
        .map((c) => accessRepository.createCategory({
          eventId,
          name: c.name,
          ...(c.description && { description: c.description }),
          color: c.color,
        }))
    );

    const freshCategories = [...target.categories, ...createdCategories];
    const categoryBySourceId = new Map(source.categories.map((sourceCategory) => [
      sourceCategory.id,
      freshCategories.find((targetCategory) => targetCategory.name === sourceCategory.name)?.id,
    ]));

    const rights: { categoryId: string; zoneId: string; accessLevel: ZoneAccessLevel }[] = [];
    for (const category of source.categories) {
      const targetCategoryId = categoryBySourceId.get(category.id);
      if (!targetCategoryId) continue;
      for (const right of category.accessRights) {
        const targetZoneId = zoneBySourceId.get(right.zoneId);
        if (targetZoneId) rights.push({ categoryId: targetCategoryId, zoneId: targetZoneId, accessLevel: right.accessLevel });
      }
    }
    if (rights.length) await accessRepository.bulkUpsertAccessRights(rights);

    return { zones: createdZones.length, categories: createdCategories.length, rights: rights.length };
  },

  verifyAgentCode(code: string) {
    assertAgentCode(code);
    return { valid: true };
  },

  async reportSuspectBadge(badgeId: string, reportedById: string, reason: string) {
    const badge = await accessRepository.findBadgeById(badgeId);
    if (!badge) throw new AppError("Badge introuvable", StatusCodes.NOT_FOUND);
    return accessRepository.createSuspectReport({ badgeId, reportedById, reason });
  },

  async getSuspectReports(eventId: string, userId: string, role: string) {
    await assertOrganizerOrAdmin(eventId, userId, role);
    return accessRepository.findSuspectReportsByEvent(eventId);
  },

  // ─── Tarification badge ──────────────────────────────────────────────

  async getBadgePricing() {
    const config = await prisma.badgePricingConfig.findUnique({ where: { id: "default" } });
    return config ?? { id: "default", unitCost: 500, currency: "FCFA", updatedAt: new Date(), updatedBy: null };
  },

  async updateBadgePricing(unitCost: number, updatedBy: string) {
    return prisma.badgePricingConfig.upsert({
      where: { id: "default" },
      update: { unitCost, updatedBy },
      create: { id: "default", unitCost, currency: "FCFA", updatedBy },
    });
  },

  // ─── Commandes de badges (événements privés) ─────────────────────────

  async createBadgeOrder(data: {
    eventId: string;
    organizerId: string;
    quantity: number;
  }) {
    const event = await prisma.event.findUnique({ where: { id: data.eventId } });
    if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
    if (event.organizerId !== data.organizerId) throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
    if (!event.isPrivateForBadges) throw new AppError("Cet événement n'est pas un événement privé pour badges", StatusCodes.BAD_REQUEST);

    const pricing = await accessService.getBadgePricing();
    const totalAmount = data.quantity * pricing.unitCost;

    return prisma.badgeOrder.create({
      data: {
        eventId: data.eventId,
        organizerId: data.organizerId,
        quantity: data.quantity,
        unitCost: pricing.unitCost,
        totalAmount,
        currency: pricing.currency,
        status: "pending",
      },
    });
  },

  async simulatePayBadgeOrder(orderId: string, organizerId: string) {
    const order = await prisma.badgeOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError("Commande introuvable", StatusCodes.NOT_FOUND);
    if (order.organizerId !== organizerId) throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
    if (order.status !== "pending") throw new AppError("Commande déjà traitée", StatusCodes.BAD_REQUEST);

    return prisma.badgeOrder.update({
      where: { id: orderId },
      data: {
        status: "paid",
        paidAt: new Date(),
        paymentMethod: "simulation",
        paymentRef: `SIM-${Date.now()}`,
      },
    });
  },

  async getOrganizerBadgeOrders(organizerId: string) {
    return prisma.badgeOrder.findMany({
      where: { organizerId },
      include: { event: { select: { id: true, title: true, date: true, location: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async getAdminBadgeOrders() {
    return prisma.badgeOrder.findMany({
      include: {
        event: { select: { id: true, title: true } },
        organizer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
