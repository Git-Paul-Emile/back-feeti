/**
 * ═══════════════════════════════════════════════════════════════════════
 *  TESTS — WalletService
 *  Couverture: création/lecture wallet, vérification d'intégrité,
 *              ledger, formatage des soldes
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";

// ─── Mocks hoistés ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  findByOrganizerId: vi.fn(),
  upsertForOrganizer: vi.fn(),
  getWalletSummaryByOrganizer: vi.fn(),
  replayLedger: vi.fn(),
  getLedgerEntries: vi.fn(),
}));

vi.mock("../repositories/wallet.repository.js", () => ({
  walletRepository: {
    findByOrganizerId: mocks.findByOrganizerId,
    upsertForOrganizer: mocks.upsertForOrganizer,
    getWalletSummaryByOrganizer: mocks.getWalletSummaryByOrganizer,
    replayLedger: mocks.replayLedger,
    getLedgerEntries: mocks.getLedgerEntries,
  },
}));

// Prisma non utilisé directement par walletService (passe par le repo)
vi.mock("../config/database.js", () => ({
  prisma: {},
}));

import { walletService } from "../services/wallet.service.js";

// ─── Wallet de référence ──────────────────────────────────────────────
const FAKE_WALLET = {
  id: "wallet-1",
  organizerId: "org-1",
  soldeTotal: 10_000_000,
  soldeDisponible: 8_000_000,
  soldeEnAttente: 2_000_000,
  soldeRetirable: 7_500_000,
  totalRetire: 500_000,
  totalEnLitige: 0,
  devise: "XOF",
  version: 1,
  checksum: "abc123",
};

// ═════════════════════════════════════════════════════════════════════
// GROUPE 1 — getOrCreateWallet
// ═════════════════════════════════════════════════════════════════════

describe("getOrCreateWallet", () => {

  beforeEach(() => vi.clearAllMocks());

  it("appelle upsertForOrganizer avec l'organizerId et la devise", async () => {
    mocks.upsertForOrganizer.mockResolvedValue(FAKE_WALLET);

    await walletService.getOrCreateWallet("org-1", "XOF");

    expect(mocks.upsertForOrganizer).toHaveBeenCalledWith("org-1", "XOF");
  });

  it("utilise 'XOF' comme devise par défaut", async () => {
    mocks.upsertForOrganizer.mockResolvedValue(FAKE_WALLET);

    await walletService.getOrCreateWallet("org-1");

    expect(mocks.upsertForOrganizer).toHaveBeenCalledWith("org-1", "XOF");
  });

  it("retourne le wallet créé/existant", async () => {
    mocks.upsertForOrganizer.mockResolvedValue(FAKE_WALLET);

    const result = await walletService.getOrCreateWallet("org-1");

    expect(result).toEqual(FAKE_WALLET);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 2 — getWalletByOrganizerId
// ═════════════════════════════════════════════════════════════════════

describe("getWalletByOrganizerId", () => {

  beforeEach(() => vi.clearAllMocks());

  it("lève NOT_FOUND (404) si le wallet est introuvable", async () => {
    mocks.findByOrganizerId.mockResolvedValue(null);

    await expect(
      walletService.getWalletByOrganizerId("org-unknown")
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("retourne le wallet si trouvé", async () => {
    mocks.findByOrganizerId.mockResolvedValue(FAKE_WALLET);

    const result = await walletService.getWalletByOrganizerId("org-1");

    expect(result).toEqual(FAKE_WALLET);
  });

  it("le message d'erreur est explicite", async () => {
    mocks.findByOrganizerId.mockResolvedValue(null);

    try {
      await walletService.getWalletByOrganizerId("org-x");
    } catch (err: unknown) {
      expect((err as { message: string }).message).toMatch(/wallet/i);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 3 — getWalletSummary
// ═════════════════════════════════════════════════════════════════════

describe("getWalletSummary", () => {

  beforeEach(() => vi.clearAllMocks());

  it("crée le wallet si getWalletSummaryByOrganizer retourne null", async () => {
    mocks.getWalletSummaryByOrganizer.mockResolvedValue(null);
    mocks.upsertForOrganizer.mockResolvedValue(FAKE_WALLET);

    const result = await walletService.getWalletSummary("org-new");

    expect(mocks.upsertForOrganizer).toHaveBeenCalledWith("org-new");
    expect(result).toEqual(FAKE_WALLET);
  });

  it("retourne le summary avec les champs formatted si le wallet existe", async () => {
    mocks.getWalletSummaryByOrganizer.mockResolvedValue(FAKE_WALLET);

    const result = await walletService.getWalletSummary("org-1") as typeof FAKE_WALLET & { formatted: unknown };

    expect(result.formatted).toBeDefined();
  });

  it("formatted contient soldeDisponible formaté", async () => {
    mocks.getWalletSummaryByOrganizer.mockResolvedValue(FAKE_WALLET);

    const result = await walletService.getWalletSummary("org-1") as {
      formatted: { soldeDisponible: string }
    };

    expect(result.formatted.soldeDisponible).toBeDefined();
    expect(typeof result.formatted.soldeDisponible).toBe("string");
  });

  it("formatted contient tous les soldes attendus", async () => {
    mocks.getWalletSummaryByOrganizer.mockResolvedValue(FAKE_WALLET);

    const result = await walletService.getWalletSummary("org-1") as {
      formatted: Record<string, string>
    };

    expect(result.formatted).toHaveProperty("soldeTotal");
    expect(result.formatted).toHaveProperty("soldeDisponible");
    expect(result.formatted).toHaveProperty("soldeEnAttente");
    expect(result.formatted).toHaveProperty("soldeRetirable");
    expect(result.formatted).toHaveProperty("totalRetire");
    expect(result.formatted).toHaveProperty("totalEnLitige");
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 4 — verifierIntegrite
// ═════════════════════════════════════════════════════════════════════

describe("verifierIntegrite", () => {

  beforeEach(() => vi.clearAllMocks());

  it("lève NOT_FOUND si le wallet n'existe pas", async () => {
    mocks.findByOrganizerId.mockResolvedValue(null);

    await expect(
      walletService.verifierIntegrite("org-unknown")
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("retourne coherent=true si soldeDisponible = replay du ledger", async () => {
    mocks.findByOrganizerId.mockResolvedValue({ ...FAKE_WALLET, soldeDisponible: 8_000_000 });
    mocks.replayLedger.mockResolvedValue(8_000_000); // même valeur

    const result = await walletService.verifierIntegrite("org-1");

    expect(result.coherent).toBe(true);
    expect(result.ecart).toBe(0);
  });

  it("retourne coherent=false si soldeDisponible ≠ replay du ledger", async () => {
    mocks.findByOrganizerId.mockResolvedValue({ ...FAKE_WALLET, soldeDisponible: 8_000_000 });
    mocks.replayLedger.mockResolvedValue(7_990_000); // écart de 10 000 centimes

    const result = await walletService.verifierIntegrite("org-1");

    expect(result.coherent).toBe(false);
    expect(result.ecart).toBe(10_000);
  });

  it("soldeEnregistre et soldeCalcule sont exposés dans le résultat", async () => {
    mocks.findByOrganizerId.mockResolvedValue({ ...FAKE_WALLET, soldeDisponible: 5_000_000 });
    mocks.replayLedger.mockResolvedValue(4_800_000);

    const result = await walletService.verifierIntegrite("org-1");

    expect(result.soldeEnregistre).toBe(5_000_000);
    expect(result.soldeCalcule).toBe(4_800_000);
  });

  it("message positif si intègre", async () => {
    mocks.findByOrganizerId.mockResolvedValue({ ...FAKE_WALLET, soldeDisponible: 1_000_000 });
    mocks.replayLedger.mockResolvedValue(1_000_000);

    const result = await walletService.verifierIntegrite("org-1");

    expect(result.message).toContain("✅");
  });

  it("message négatif si écart détecté", async () => {
    mocks.findByOrganizerId.mockResolvedValue({ ...FAKE_WALLET, soldeDisponible: 1_000_000 });
    mocks.replayLedger.mockResolvedValue(900_000);

    const result = await walletService.verifierIntegrite("org-1");

    expect(result.message).toContain("⚠️");
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 5 — getLedger
// ═════════════════════════════════════════════════════════════════════

describe("getLedger", () => {

  beforeEach(() => vi.clearAllMocks());

  it("lève NOT_FOUND si wallet introuvable", async () => {
    mocks.findByOrganizerId.mockResolvedValue(null);

    await expect(
      walletService.getLedger("org-unknown")
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("appelle getLedgerEntries avec le bon walletId", async () => {
    mocks.findByOrganizerId.mockResolvedValue(FAKE_WALLET);
    mocks.getLedgerEntries.mockResolvedValue([]);

    await walletService.getLedger("org-1", { page: 1, limit: 20 });

    expect(mocks.getLedgerEntries).toHaveBeenCalledWith("wallet-1", { page: 1, limit: 20 });
  });
});
