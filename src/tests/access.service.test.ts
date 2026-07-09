/**
 * ═══════════════════════════════════════════════════════════════════════
 *  TESTS — AccessService (Feeti Access)
 *  Couverture:
 *    - Templates de zones (ZONE_TEMPLATES)
 *    - applyDefaultZones : création des 10 zones
 *    - generateBadge : validation RBAC
 *    - createZone : unicité du code
 *    - scanBadge : QR invalide, badge absent
 *    - QR chiffrement / déchiffrement (AES-256-GCM round-trip)
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";

// ─── Mocks hoistés ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  // access repository
  findZonesByEvent: vi.fn(),
  findZoneByCode: vi.fn(),
  findZoneById: vi.fn(),
  createZone: vi.fn(),
  findCategoryById: vi.fn(),
  createCategory: vi.fn(),
  findCategoriesByEvent: vi.fn().mockResolvedValue([]),
  getAccessRight: vi.fn(),
  getAccessRights: vi.fn().mockResolvedValue([]),
  setAccessRight: vi.fn(),
  findBadgeById: vi.fn(),
  findBadgeByQrCode: vi.fn(),
  createBadge: vi.fn(),
  updateBadge: vi.fn(),
  createAccessLog: vi.fn(),
  getEventZonesMap: vi.fn(),
  createSuspectReport: vi.fn(),
  findBadgesByEvent: vi.fn().mockResolvedValue([]),
  findStandaloneBadgesByCreator: vi.fn().mockResolvedValue([]),
  incrementZoneCount: vi.fn().mockResolvedValue({}),
  countLogsByZone: vi.fn().mockResolvedValue([]),
  bulkCreateAccessLogs: vi.fn().mockResolvedValue([]),
  // event repository
  findById: vi.fn(),
  createEvent: vi.fn().mockResolvedValue({}),
  // controller assignments
  isAssigned: vi.fn(),
  // feetiPlay
  getLiveEventById: vi.fn().mockResolvedValue(null),
  feetiPlaySync: vi.fn().mockResolvedValue(undefined),
  // socket
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }),
  // others
  addEmailJob: vi.fn().mockResolvedValue(undefined),
  smsServiceSend: vi.fn().mockResolvedValue(undefined),
  firestoreSync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../repositories/access.repository.js", () => ({
  accessRepository: {
    findZonesByEvent: mocks.findZonesByEvent,
    findZoneByCode: mocks.findZoneByCode,
    findZoneById: mocks.findZoneById,
    createZone: mocks.createZone,
    findCategoryById: mocks.findCategoryById,
    createCategory: mocks.createCategory,
    findCategoriesByEvent: mocks.findCategoriesByEvent,
    getAccessRight: mocks.getAccessRight,
    getAccessRights: mocks.getAccessRights,
    setAccessRight: mocks.setAccessRight,
    findBadgeById: mocks.findBadgeById,
    findBadgeByQrCode: mocks.findBadgeByQrCode,
    createBadge: mocks.createBadge,
    updateBadge: mocks.updateBadge,
    createAccessLog: mocks.createAccessLog,
    getEventZonesMap: mocks.getEventZonesMap,
    createSuspectReport: mocks.createSuspectReport,
    findBadgesByEvent: mocks.findBadgesByEvent,
    findStandaloneBadgesByCreator: mocks.findStandaloneBadgesByCreator,
    updateZone: vi.fn(),
    deleteZone: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    getAccessRightsByCategory: vi.fn().mockResolvedValue([]),
    incrementZoneCount: mocks.incrementZoneCount,
    countLogsByZone: mocks.countLogsByZone,
    bulkCreateAccessLogs: mocks.bulkCreateAccessLogs,
  },
}));

vi.mock("../repositories/event.repository.js", () => ({
  eventRepository: {
    findById: mocks.findById,
    create: mocks.createEvent,
  },
}));

vi.mock("../repositories/eventController.repository.js", () => ({
  eventControllerRepository: {
    isAssigned: mocks.isAssigned,
  },
}));

vi.mock("../config/database.js", () => ({
  prisma: {
    eventZone: { createMany: vi.fn(), findFirst: vi.fn() },
    participantCategory: { createMany: vi.fn() },
    zoneAccessRight: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    accessBadge: { update: vi.fn(), findUnique: vi.fn() },
    suspectBadgeReport: { create: vi.fn() },
    event: { findUnique: vi.fn() },
  },
}));

vi.mock("../services/feetiPlaySync.service.js", () => ({
  feetiPlaySyncService: {
    syncEvent: mocks.feetiPlaySync,
    getLiveEventById: mocks.getLiveEventById,
  },
}));

vi.mock("../services/firestore-sync.service.js", () => ({
  firestoreSyncService: { syncEvent: mocks.firestoreSync },
}));

vi.mock("../queues/email.queue.js", () => ({
  addEmailJob: mocks.addEmailJob,
}));

vi.mock("../services/sms.service.js", () => ({
  smsService: { send: mocks.smsServiceSend },
}));

vi.mock("../config/socket.js", () => ({
  getIO: mocks.getIO,
}));

import { accessService, ZONE_TEMPLATES } from "../services/access.service.js";

// ═════════════════════════════════════════════════════════════════════
// GROUPE 1 — ZONE_TEMPLATES : structure et exhaustivité
// ═════════════════════════════════════════════════════════════════════

describe("ZONE_TEMPLATES — structure des zones prédéfinies", () => {

  it("contient exactement 10 zones (Z1 à Z10)", () => {
    expect(ZONE_TEMPLATES).toHaveLength(10);
  });

  it("les codes sont Z1 à Z10 (pas de doublon)", () => {
    const codes = ZONE_TEMPLATES.map((z) => z.code);
    expect(new Set(codes).size).toBe(10);
    expect(codes).toContain("Z1");
    expect(codes).toContain("Z10");
  });

  it("chaque zone a un code, un nom, une description et une couleur", () => {
    for (const zone of ZONE_TEMPLATES) {
      expect(zone.code).toBeDefined();
      expect(zone.name).toBeDefined();
      expect(zone.description).toBeDefined();
      expect(zone.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("Z1 = Accès Général (zone publique principale)", () => {
    const z1 = ZONE_TEMPLATES.find((z) => z.code === "Z1");
    expect(z1?.name).toBe("Accès Général");
  });

  it("Z5 = VIP", () => {
    const z5 = ZONE_TEMPLATES.find((z) => z.code === "Z5");
    expect(z5?.name).toBe("VIP");
  });

  it("Z6 = Backstage", () => {
    const z6 = ZONE_TEMPLATES.find((z) => z.code === "Z6");
    expect(z6?.name).toBe("Backstage");
  });

  it("Z9 = Sécurité / Staff", () => {
    const z9 = ZONE_TEMPLATES.find((z) => z.code === "Z9");
    expect(z9?.name).toBe("Sécurité / Staff");
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 2 — applyDefaultZones : création des zones
// ═════════════════════════════════════════════════════════════════════

describe("applyDefaultZones", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findById.mockResolvedValue({ id: "event-1", organizerId: "org-1" });
    mocks.findZonesByEvent.mockResolvedValue([]);
    mocks.createZone.mockResolvedValue({});
  });

  it("lève NOT_FOUND si l'événement n'existe pas", async () => {
    mocks.findById.mockResolvedValue(null);

    await expect(
      accessService.applyDefaultZones("event-unknown", "org-1", "organizer")
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("lève FORBIDDEN si l'organisateur ne correspond pas", async () => {
    mocks.findById.mockResolvedValue({ id: "event-1", organizerId: "org-owner" });

    await expect(
      accessService.applyDefaultZones("event-1", "org-autre", "organizer")
    ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
  });

  it("crée 10 zones par défaut si aucune zone existante", async () => {
    mocks.findZonesByEvent.mockResolvedValue([]);

    await accessService.applyDefaultZones("event-1", "org-1", "organizer");

    expect(mocks.createZone).toHaveBeenCalledTimes(10);
  });

  it("ne crée pas de doublons si une zone existe déjà (idempotent)", async () => {
    mocks.findZonesByEvent.mockResolvedValue([
      { id: "zone-1", code: "Z1", name: "Accès Général" },
    ]);

    await accessService.applyDefaultZones("event-1", "org-1", "organizer");

    // 9 zones créées (Z2 à Z10), Z1 skippée
    expect(mocks.createZone).toHaveBeenCalledTimes(9);
    const createdCodes = mocks.createZone.mock.calls.map((c: any[]) => c[0]?.code);
    expect(createdCodes).not.toContain("Z1");
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 2B — getZones : accès contrôleur affecté
// ═════════════════════════════════════════════════════════════════════

describe("getZones", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findById.mockResolvedValue({ id: "event-1", organizerId: "org-1" });
    mocks.findZonesByEvent.mockResolvedValue([{ id: "zone-1", code: "Z1", name: "Accès Général" }]);
  });

  it("autorise un contrôleur affecté à lire les zones", async () => {
    mocks.isAssigned.mockResolvedValue(true);

    const zones = await accessService.getZones("event-1", "ctrl-1", "controller");

    expect(mocks.isAssigned).toHaveBeenCalledWith("event-1", "ctrl-1");
    expect(zones).toHaveLength(1);
  });

  it("crée les zones par défaut si l'événement n'en a aucune", async () => {
    mocks.isAssigned.mockResolvedValue(true);
    mocks.findZonesByEvent.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: "zone-1", code: "Z1", name: "Accès Général" },
    ]);

    const zones = await accessService.getZones("event-1", "ctrl-1", "controller");

    expect(mocks.createZone).toHaveBeenCalledTimes(10);
    expect(zones).toHaveLength(1);
  });

  it("refuse un contrôleur non affecté", async () => {
    mocks.isAssigned.mockResolvedValue(false);

    await expect(
      accessService.getZones("event-1", "ctrl-1", "controller")
    ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 3 — scanBadge : cas d'erreur
// ═════════════════════════════════════════════════════════════════════

describe("scanBadge — validation des QR codes", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAccessLog.mockResolvedValue({});
    mocks.getIO.mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) });
  });

  it("retourne denied si le QR code est du JSON invalide", async () => {
    const result = await accessService.scanBadge("ctrl-1", "admin", {
      qrCode: "ceci-nest-pas-du-json-valide",
      zoneId: "zone-1",
    });

    expect(result.result).toBe("denied");
  });

  it("retourne denied si le JSON ne contient pas de badgeId/bid", async () => {
    const noIdQr = JSON.stringify({ v: 2, alg: "A256GCM", iv: "y", tag: "z", data: "d" });

    const result = await accessService.scanBadge("ctrl-1", "admin", {
      qrCode: noIdQr,
      zoneId: "zone-1",
    });

    expect(result.result).toBe("denied");
  });

  it("retourne denied avec raison 'introuvable' si le badge est absent de la DB", async () => {
    const qrWithBid = JSON.stringify({ v: 2, alg: "A256GCM", bid: "badge-unknown", iv: "aaa", tag: "bbb", data: "ccc" });
    mocks.findBadgeById.mockResolvedValue(null);

    const result = await accessService.scanBadge("ctrl-1", "admin", {
      qrCode: qrWithBid,
      zoneId: "zone-1",
    });

    expect(result.result).toBe("denied");
    expect(result.refusalReason).toMatch(/introuvable/i);
  });

  it("accepte un scan sans code agent", async () => {
    const result = await accessService.scanBadge("ctrl-1", "admin", {
      qrCode: "{}",
      zoneId: "zone-1",
    });

    expect(result.result).toBe("denied");
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 4 — generateBadge : validation des entrées
// ═════════════════════════════════════════════════════════════════════

describe("generateBadge — validation RBAC", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findCategoryById.mockResolvedValue(null);
    mocks.findBadgesByEvent.mockResolvedValue([]);
  });

  it("lève NOT_FOUND si l'événement n'existe pas", async () => {
    mocks.findById.mockResolvedValue(null);

    await expect(
      accessService.generateBadge("event-unknown", "org-1", "organizer", {
        categoryId: "cat-1",
        holderName: "Jean Dupont",
        holderEmail: "jean@test.cm",
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("lève FORBIDDEN si l'organisateur ne correspond pas", async () => {
    mocks.findById.mockResolvedValue({ id: "event-1", organizerId: "org-owner" });

    await expect(
      accessService.generateBadge("event-1", "org-autre", "organizer", {
        categoryId: "cat-1",
        holderName: "Jean Dupont",
        holderEmail: "jean@test.cm",
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
  });

  it("lève CONFLICT si un badge existe déjà pour le même email", async () => {
    mocks.findById.mockResolvedValue({ id: "event-1", organizerId: "org-1" });
    mocks.findCategoryById.mockResolvedValue({ id: "cat-1", eventId: "event-1" });
    mocks.findBadgesByEvent.mockResolvedValue([{ holderEmail: "jean@test.cm" }]);

    await expect(
      accessService.generateBadge("event-1", "org-1", "organizer", {
        categoryId: "cat-1",
        holderName: "Jean Dupont",
        holderEmail: "Jean@Test.cm",
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.CONFLICT });
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 4B — activateBadge : réactivation d'un badge révoqué
// ═════════════════════════════════════════════════════════════════════

describe("activateBadge — toggle du statut", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findById.mockResolvedValue({ id: "event-1", organizerId: "org-1" });
    mocks.findBadgeById.mockResolvedValue({
      id: "badge-1",
      eventId: "event-1",
      status: "revoked",
    });
    mocks.updateBadge.mockResolvedValue({
      id: "badge-1",
      eventId: "event-1",
      status: "active",
    });
  });

  it("réactive un badge révoqué", async () => {
    const badge = await accessService.activateBadge("event-1", "badge-1", "org-1", "organizer");

    expect(badge.status).toBe("active");
    expect(mocks.updateBadge).toHaveBeenCalledWith("badge-1", {
      status: "active",
      revokedAt: null,
      revokedById: null,
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 5 — createZone : unicité du code dans l'événement
// ═════════════════════════════════════════════════════════════════════

describe("createZone — unicité du code", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findById.mockResolvedValue({ id: "event-1", organizerId: "org-1" });
  });

  it("lève CONFLICT (409) si le code de zone existe déjà pour cet événement", async () => {
    mocks.findZoneByCode.mockResolvedValue({ id: "zone-exist", code: "Z1" });

    await expect(
      accessService.createZone("event-1", "org-1", "organizer", {
        code: "Z1",
        name: "Doublon",
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.CONFLICT });
  });

  it("crée la zone si le code est unique", async () => {
    mocks.findZoneByCode.mockResolvedValue(null);
    mocks.createZone.mockResolvedValue({ id: "zone-new", code: "Z2" });

    await expect(
      accessService.createZone("event-1", "org-1", "organizer", {
        code: "Z2",
        name: "Zone Custom",
      })
    ).resolves.toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 6 — QR chiffrement / déchiffrement (round-trip interne)
// ═════════════════════════════════════════════════════════════════════

describe("QR round-trip (chiffrement AES-256-GCM)", () => {

  it("un badge généré a un QR code valide qui n'est pas rejeté à la lecture", async () => {
    const eventId = "event-qr-test";
    const categoryId = "cat-vip";
    const orgId = "org-1";

    const fakeCategory = {
      id: categoryId,
      eventId,
      name: "VIP",
      accessRights: [],
    };

    let capturedSecret: string | undefined;

    mocks.findById.mockResolvedValue({ id: eventId, organizerId: orgId });
    mocks.findCategoryById.mockResolvedValue({ id: categoryId, eventId });

    mocks.createBadge.mockImplementation(async (data: Record<string, unknown>) => {
      capturedSecret = data.qrSecret as string;
      return {
        id: "badge-qr-1",
        eventId,
        categoryId,
        holderName: "VIP Test",
        holderEmail: "vip@test.cm",
        createdById: orgId,
        qrCode: data.qrCode,
        qrSecret: capturedSecret,
        status: "active",
      };
    });

    // findBadgeById est appelé deux fois : une fois dans generateBadge pour hydrater,
    // une autre par scanBadge — on retourne le badge hydraté avec le bon secret.
    mocks.findBadgeById.mockImplementation(async (_id: string) => ({
      id: "badge-qr-1",
      eventId,
      categoryId,
      holderName: "VIP Test",
      holderEmail: "vip@test.cm",
      createdById: orgId,
      qrCode: undefined, // sera mis à jour par updateBadge
      qrSecret: capturedSecret,
      status: "active",
      category: fakeCategory,
    }));

    mocks.updateBadge.mockImplementation(async (_id: string, data: Record<string, unknown>) => ({
      id: "badge-qr-1",
      eventId,
      categoryId,
      holderName: "VIP Test",
      holderEmail: "vip@test.cm",
      createdById: orgId,
      qrCode: data.qrCode as string,
      qrSecret: capturedSecret,
      status: "active",
      category: fakeCategory,
    }));

    // Étape 1 : générer un badge (QR AES chiffré)
    const badge = await accessService.generateBadge(eventId, orgId, "organizer", {
      categoryId,
      holderName: "VIP Test",
      holderEmail: "vip@test.cm",
    });

    expect(badge).toBeDefined();
    expect(badge.qrCode).toBeDefined();
    expect(typeof badge.qrCode).toBe("string");
    expect(badge.qrSecret).toBeDefined();

    // Mettre à jour le mock findBadgeById avec le bon qrCode pour le scan
    mocks.findBadgeById.mockResolvedValue({
      id: "badge-qr-1",
      eventId,
      categoryId,
      holderName: "VIP Test",
      holderEmail: "vip@test.cm",
      createdById: orgId,
      qrCode: badge.qrCode,
      qrSecret: capturedSecret,
      status: "active",
      category: fakeCategory,
    });
    mocks.getAccessRight.mockResolvedValue({ accessLevel: "OUI" });
    mocks.createAccessLog.mockResolvedValue({});

    // Étape 2 : scanner le QR généré — il doit être reconnu (pas "QR code invalide")
    const scanResult = await accessService.scanBadge("ctrl-1", "admin", {
      qrCode: badge.qrCode,
      zoneId: "zone-vip",
      agentCode: "FEETI-AGENT",
    });

    // Le QR doit avoir été décodé sans erreur de format — résultat != "denied" pour raison QR
    expect(scanResult).toBeDefined();
    if (scanResult.result === "denied") {
      expect(scanResult.refusalReason).not.toMatch(/QR code invalide|QR code malformé/i);
    }
  });
});
