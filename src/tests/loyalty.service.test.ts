/**
 * ═══════════════════════════════════════════════════════════════════════
 *  TESTS — LoyaltyService (Feeti Na Feeti)
 *  Couverture: calcul de points, anti-fraude partages, parrainage,
 *              paiement avec points (plafond 50%), missions, badges
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";

// ─── Mocks hoistés ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  getOrCreateProfile: vi.fn(),
  updatePoints: vi.fn(),
  getTodayShareCount: vi.fn(),
  incrementShareCount: vi.fn(),
  getProfileByReferralCode: vi.fn(),
  getLedger: vi.fn(),
  getBadgesForUser: vi.fn(),
  // Bonus multiplier
  getActiveBonuses: vi.fn().mockResolvedValue([]),
  // Missions
  getMissions: vi.fn().mockResolvedValue([]),
  getMissionProgress: vi.fn().mockResolvedValue([]),
  updateMissionProgress: vi.fn(),
  // prisma
  prismaLoyaltyProfileUpdate: vi.fn(),
  prismaLoyaltyProfileCount: vi.fn(),
  prismaPointsLedgerCount: vi.fn().mockResolvedValue(0),
}));

vi.mock("../repositories/loyalty.repository.js", () => ({
  loyaltyRepository: {
    getOrCreateProfile: mocks.getOrCreateProfile,
    updatePoints: mocks.updatePoints,
    getTodayShareCount: mocks.getTodayShareCount,
    incrementShareCount: mocks.incrementShareCount,
    getProfileByReferralCode: mocks.getProfileByReferralCode,
    getLedger: mocks.getLedger,
    getBadgesForUser: mocks.getBadgesForUser,
    getActiveBonuses: mocks.getActiveBonuses,
    getMissions: mocks.getMissions,
    getMissionProgress: mocks.getMissionProgress,
    updateMissionProgress: mocks.updateMissionProgress,
  },
}));

vi.mock("../config/database.js", () => ({
  prisma: {
    loyaltyProfile: {
      update: mocks.prismaLoyaltyProfileUpdate,
      count: mocks.prismaLoyaltyProfileCount,
    },
    ambassadorBadge: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    loyaltyBonus: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    pointsLedger: {
      count: mocks.prismaPointsLedgerCount,
    },
    communityPost: {
      count: vi.fn().mockResolvedValue(0),
    },
    vipAccessLog: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

import { loyaltyService } from "../services/loyalty.service.js";

// ─── Profile de base pour les tests ─────────────────────────────────
const BASE_PROFILE = {
  id: "profile-1",
  userId: "user-1",
  points: 500,
  pointsEarned: 700,
  pointsSpent: 200,
  level: "Mobembo",
  eventsAttended: 3,
  totalSpent: 50_000,
  referralCode: "FEETI-ABC",
  referredById: null,
  referralFirstEventBonusPaid: false,
  referralSignupBonusPaid: false,
};

const BASE_PROFILE_NO_REFERRAL = {
  ...BASE_PROFILE,
  referredById: null,
  referralFirstEventBonusPaid: false,
};

// ═════════════════════════════════════════════════════════════════════
// GROUPE 1 — onTicketPurchase : calcul de points
// ═════════════════════════════════════════════════════════════════════

describe("onTicketPurchase — calcul de points", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrCreateProfile.mockResolvedValue(BASE_PROFILE);
    mocks.updatePoints.mockResolvedValue({});
    mocks.getActiveBonuses.mockResolvedValue([]);
    mocks.getMissions.mockResolvedValue([]);
    mocks.getMissionProgress.mockResolvedValue([]);
    mocks.prismaLoyaltyProfileUpdate.mockResolvedValue({});
    mocks.prismaLoyaltyProfileCount.mockResolvedValue(0);
  });

  it("achat 10 000 FCFA → 100 points (1 pt / 100 FCFA)", async () => {
    await loyaltyService.onTicketPurchase("user-1", 10_000, "ticket-1");

    const call = mocks.updatePoints.mock.calls[0];
    // points = Math.floor(10000/100) * 1 = 100
    expect(call[1]).toBe(100);
    expect(call[2]).toBe("ticket_purchase");
  });

  it("achat 5 000 FCFA → 50 points", async () => {
    await loyaltyService.onTicketPurchase("user-1", 5_000, "ticket-1");
    expect(mocks.updatePoints.mock.calls[0][1]).toBe(50);
  });

  it("achat 99 FCFA → 0 points (en dessous du seuil minimal)", async () => {
    await loyaltyService.onTicketPurchase("user-1", 99, "ticket-1");
    // points = Math.floor(99/100) = 0 → updatePoints n'est pas appelé
    expect(mocks.updatePoints).not.toHaveBeenCalled();
  });

  it("achat 0 FCFA → 0 points", async () => {
    await loyaltyService.onTicketPurchase("user-1", 0, "ticket-1");
    expect(mocks.updatePoints).not.toHaveBeenCalled();
  });

  it("achat 50 000 FCFA → 500 points", async () => {
    await loyaltyService.onTicketPurchase("user-1", 50_000, "ticket-1");
    expect(mocks.updatePoints.mock.calls[0][1]).toBe(500);
  });

  it("la référence (ticketId) est passée à updatePoints", async () => {
    await loyaltyService.onTicketPurchase("user-1", 10_000, "ticket-xyz");
    const call = mocks.updatePoints.mock.calls[0];
    expect(call[4]).toBe("ticket-xyz"); // referenceId
    expect(call[5]).toBe("ticket");      // referenceType
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 2 — onEventAttendance : 200 points
// ═════════════════════════════════════════════════════════════════════

describe("onEventAttendance — présence à un événement", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrCreateProfile.mockResolvedValue(BASE_PROFILE_NO_REFERRAL);
    mocks.updatePoints.mockResolvedValue({});
    mocks.getActiveBonuses.mockResolvedValue([]);
    mocks.getMissions.mockResolvedValue([]);
    mocks.getMissionProgress.mockResolvedValue([]);
    mocks.prismaLoyaltyProfileUpdate.mockResolvedValue({});
  });

  it("attribue 200 points pour présence à un événement", async () => {
    await loyaltyService.onEventAttendance("user-1", "event-1");

    const call = mocks.updatePoints.mock.calls[0];
    expect(call[1]).toBe(200);
    expect(call[2]).toBe("event_attendance");
  });

  it("la référence (eventId) est passée à updatePoints", async () => {
    await loyaltyService.onEventAttendance("user-1", "event-abc");

    const call = mocks.updatePoints.mock.calls[0];
    expect(call[4]).toBe("event-abc");
    expect(call[5]).toBe("event");
  });

  it("incrémente eventsAttended sur le profil", async () => {
    await loyaltyService.onEventAttendance("user-1", "event-1");
    expect(mocks.prismaLoyaltyProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BASE_PROFILE.id },
        data: { eventsAttended: { increment: 1 } },
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 3 — onEventShare : anti-fraude journalier
// ═════════════════════════════════════════════════════════════════════

describe("onEventShare — anti-fraude (max 10 partages/jour)", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrCreateProfile.mockResolvedValue(BASE_PROFILE);
    mocks.updatePoints.mockResolvedValue({});
    mocks.incrementShareCount.mockResolvedValue({});
    mocks.getActiveBonuses.mockResolvedValue([]);
    mocks.getMissions.mockResolvedValue([]);
    mocks.getMissionProgress.mockResolvedValue([]);
  });

  it("attribue 20 points pour un partage valide (< 10/jour)", async () => {
    mocks.getTodayShareCount.mockResolvedValue(5); // 5 partages déjà faits

    const result = await loyaltyService.onEventShare("user-1", "event-1");

    expect(result.points).toBe(20);
    expect(mocks.updatePoints).toHaveBeenCalledWith(
      BASE_PROFILE.id,
      20,
      "event_share",
      expect.any(String),
      "event-1",
      "event"
    );
  });

  it("lève TOO_MANY_REQUESTS (429) si la limite de 10 partages/jour est atteinte", async () => {
    mocks.getTodayShareCount.mockResolvedValue(10); // limite atteinte

    await expect(
      loyaltyService.onEventShare("user-1", "event-1")
    ).rejects.toMatchObject({ statusCode: StatusCodes.TOO_MANY_REQUESTS });
  });

  it("lève TOO_MANY_REQUESTS (429) si on dépasse la limite (11 partages)", async () => {
    mocks.getTodayShareCount.mockResolvedValue(11);

    await expect(
      loyaltyService.onEventShare("user-1", "event-1")
    ).rejects.toMatchObject({ statusCode: StatusCodes.TOO_MANY_REQUESTS });
  });

  it("9 partages → encore autorisé", async () => {
    mocks.getTodayShareCount.mockResolvedValue(9);

    await expect(
      loyaltyService.onEventShare("user-1", "event-1")
    ).resolves.toMatchObject({ points: 20 });
  });

  it("incrémente le compteur de partages journaliers", async () => {
    mocks.getTodayShareCount.mockResolvedValue(3);

    await loyaltyService.onEventShare("user-1", "event-1");

    expect(mocks.incrementShareCount).toHaveBeenCalledWith("user-1");
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 4 — applyReferralCode : règles anti-abus
// ═════════════════════════════════════════════════════════════════════

describe("applyReferralCode — règles anti-abus", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrCreateProfile.mockResolvedValue(BASE_PROFILE);
    mocks.updatePoints.mockResolvedValue({});
    mocks.prismaLoyaltyProfileUpdate.mockResolvedValue({});
    mocks.prismaLoyaltyProfileCount.mockResolvedValue(0);
  });

  it("lève BAD_REQUEST (400) si le code de parrainage est invalide", async () => {
    mocks.getProfileByReferralCode.mockResolvedValue(null);

    await expect(
      loyaltyService.applyReferralCode("user-new", "CODE-INVALIDE")
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si l'utilisateur tente d'utiliser son propre code", async () => {
    mocks.getProfileByReferralCode.mockResolvedValue({
      ...BASE_PROFILE,
      userId: "user-new", // même userId = auto-parrainage
    });

    await expect(
      loyaltyService.applyReferralCode("user-new", "FEETI-ABC")
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si un code de parrainage a déjà été appliqué", async () => {
    mocks.getProfileByReferralCode.mockResolvedValue({
      ...BASE_PROFILE,
      userId: "user-parrain", // autre utilisateur
    });
    mocks.getOrCreateProfile.mockResolvedValue({
      ...BASE_PROFILE,
      userId: "user-new",
      referredById: "profile-parrain", // déjà parrainé
    });

    await expect(
      loyaltyService.applyReferralCode("user-new", "FEETI-PARRAIN")
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("attribue 150 points au parrain lors d'un parrainage valide", async () => {
    const parrain = { ...BASE_PROFILE, id: "profile-parrain", userId: "user-parrain" };
    mocks.getProfileByReferralCode.mockResolvedValue(parrain);
    mocks.getOrCreateProfile.mockResolvedValue({
      ...BASE_PROFILE,
      id: "profile-new",
      userId: "user-new",
      referredById: null,
    });

    await loyaltyService.applyReferralCode("user-new", "FEETI-ABC");

    expect(mocks.updatePoints).toHaveBeenCalledWith(
      parrain.id,
      150,
      "referral_signup",
      expect.any(String),
      "user-new",
      "user"
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 5 — simulatePointsPayment : plafond 50 %
// ═════════════════════════════════════════════════════════════════════

describe("simulatePointsPayment — plafond 50 %", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("billet 10 000 FCFA, 500 pts : plafond à 250 pts (5 000 FCFA)", async () => {
    mocks.getOrCreateProfile.mockResolvedValue({ ...BASE_PROFILE, points: 500 });

    const result = await loyaltyService.simulatePointsPayment("user-1", 10_000);

    expect(result.pointsUsable).toBe(250);
    expect(result.discountFCFA).toBe(5_000);
    expect(result.amountToPay).toBe(5_000);
  });

  it("billet 10 000 FCFA, 100 pts : utilise tous les 100 points disponibles", async () => {
    mocks.getOrCreateProfile.mockResolvedValue({ ...BASE_PROFILE, points: 100 });

    const result = await loyaltyService.simulatePointsPayment("user-1", 10_000);

    expect(result.pointsUsable).toBe(100);
    expect(result.discountFCFA).toBe(2_000);
  });

  it("expose pointsAvailable dans la réponse", async () => {
    mocks.getOrCreateProfile.mockResolvedValue({ ...BASE_PROFILE, points: 300 });

    const result = await loyaltyService.simulatePointsPayment("user-1", 5_000);

    expect(result.pointsAvailable).toBe(300);
  });

  it("amountFCFA original est conservé dans la réponse", async () => {
    mocks.getOrCreateProfile.mockResolvedValue({ ...BASE_PROFILE, points: 50 });

    const result = await loyaltyService.simulatePointsPayment("user-1", 8_000);

    expect(result.amountFCFA).toBe(8_000);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 6 — applyPointsPayment : validation et application
// ═════════════════════════════════════════════════════════════════════

describe("applyPointsPayment — validation", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updatePoints.mockResolvedValue({});
    mocks.prismaLoyaltyProfileUpdate.mockResolvedValue({});
  });

  it("lève BAD_REQUEST si pointsToUse = 0", async () => {
    mocks.getOrCreateProfile.mockResolvedValue({ ...BASE_PROFILE, points: 100 });

    await expect(
      loyaltyService.applyPointsPayment("user-1", 0, "ticket-1", 10_000)
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si points insuffisants", async () => {
    mocks.getOrCreateProfile.mockResolvedValue({ ...BASE_PROFILE, points: 50 }); // seulement 50 pts

    await expect(
      loyaltyService.applyPointsPayment("user-1", 100, "ticket-1", 10_000) // demande 100
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si on dépasse le plafond 50 %", async () => {
    mocks.getOrCreateProfile.mockResolvedValue({ ...BASE_PROFILE, points: 10_000 });
    // billet 1 000 FCFA → max 500 FCFA → max 25 pts
    await expect(
      loyaltyService.applyPointsPayment("user-1", 50, "ticket-1", 1_000) // 50 > 25
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("soustrait les points du profil si valide", async () => {
    mocks.getOrCreateProfile.mockResolvedValue({ ...BASE_PROFILE, points: 500 });

    await loyaltyService.applyPointsPayment("user-1", 100, "ticket-1", 10_000);

    expect(mocks.updatePoints).toHaveBeenCalledWith(
      BASE_PROFILE.id,
      -100,
      "reward_redemption",
      expect.any(String),
      "ticket-1",
      "ticket"
    );
  });
});
