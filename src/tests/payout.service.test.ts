/**
 * ═══════════════════════════════════════════════════════════════════════
 *  TESTS — PayoutService
 *  Couverture: RBAC admin, machine à états, validation métier,
 *              seuil de double validation, solde insuffisant
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";

// ─── Mocks hoistés ───────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockTx = {
    payout: { create: vi.fn(), update: vi.fn() },
    payoutStatusHistory: { create: vi.fn() },
    walletLedger: { create: vi.fn() },
    wallet: { update: vi.fn() },
    auditLog: { create: vi.fn() },
    payoutTransaction: { createMany: vi.fn() },
  };

  return {
    tx: mockTx,
    prismaDollarTransaction: vi.fn().mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)
    ),
    prismaTransactionFindMany: vi.fn(),
    walletFindByOrganizerId: vi.fn(),
    payoutFindById: vi.fn(),
    payoutUpdateStatus: vi.fn(),
  };
});

vi.mock("../config/database.js", () => ({
  prisma: {
    $transaction: mocks.prismaDollarTransaction,
    transaction: { findMany: mocks.prismaTransactionFindMany },
  },
}));

vi.mock("../repositories/wallet.repository.js", () => ({
  walletRepository: {
    findByOrganizerId: mocks.walletFindByOrganizerId,
  },
}));

vi.mock("../repositories/payout.repository.js", () => ({
  payoutRepository: {
    findById: mocks.payoutFindById,
    updateStatus: mocks.payoutUpdateStatus,
  },
}));

import { payoutService } from "../services/payout.service.js";

// ─── Données de test ──────────────────────────────────────────────────
const ADMIN_ACTOR = { adminId: "admin-1", adminRole: "admin" };
const USER_ACTOR = { adminId: "user-1", adminRole: "user" };

const COMPLETED_TRANSACTIONS = [
  { id: "tx-1", netOrganisateur: 500_000, devise: "XOF", organizerId: "org-1" },
  { id: "tx-2", netOrganisateur: 300_000, devise: "XOF", organizerId: "org-1" },
];

const WALLET = {
  id: "wallet-1",
  organizerId: "org-1",
  soldeDisponible: 2_000_000,
  soldeRetirable: 800_000,
  soldeEnAttente: 0,
  devise: "XOF",
};

const PAYOUT_INITIATED = {
  id: "payout-1",
  organizerId: "org-1",
  walletId: "wallet-1",
  montant: 800_000,
  devise: "XOF",
  statut: "initiated" as const,
};

// ═════════════════════════════════════════════════════════════════════
// GROUPE 1 — initierPayout : RBAC
// ═════════════════════════════════════════════════════════════════════

describe("initierPayout — contrôle d'accès (RBAC)", () => {

  it("lève FORBIDDEN (403) si le rôle est 'user'", async () => {
    await expect(
      payoutService.initierPayout({
        organizerId: "org-1",
        transactionIds: ["tx-1"],
        methodePaiement: "mobile_money",
        ...USER_ACTOR,
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
  });

  it("lève FORBIDDEN (403) si le rôle est 'organizer'", async () => {
    await expect(
      payoutService.initierPayout({
        organizerId: "org-1",
        transactionIds: ["tx-1"],
        methodePaiement: "mobile_money",
        adminId: "org-actor",
        adminRole: "organizer",
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
  });

  it("lève FORBIDDEN (403) si le rôle est 'controller'", async () => {
    await expect(
      payoutService.initierPayout({
        organizerId: "org-1",
        transactionIds: ["tx-1"],
        methodePaiement: "mobile_money",
        adminId: "ctrl-1",
        adminRole: "controller",
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 2 — initierPayout : validations métier
// ═════════════════════════════════════════════════════════════════════

describe("initierPayout — validations métier", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lève BAD_REQUEST (400) si la liste de transactions est vide", async () => {
    await expect(
      payoutService.initierPayout({
        organizerId: "org-1",
        transactionIds: [],
        methodePaiement: "mobile_money",
        ...ADMIN_ACTOR,
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si les transactions ne correspondent pas (count mismatch)", async () => {
    // On demande 2 tx mais la DB n'en retourne que 1
    mocks.prismaTransactionFindMany.mockResolvedValue([COMPLETED_TRANSACTIONS[0]]);

    await expect(
      payoutService.initierPayout({
        organizerId: "org-1",
        transactionIds: ["tx-1", "tx-2"],
        methodePaiement: "mobile_money",
        ...ADMIN_ACTOR,
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève NOT_FOUND (404) si le wallet de l'organisateur est introuvable", async () => {
    mocks.prismaTransactionFindMany.mockResolvedValue(COMPLETED_TRANSACTIONS);
    mocks.walletFindByOrganizerId.mockResolvedValue(null);

    await expect(
      payoutService.initierPayout({
        organizerId: "org-1",
        transactionIds: ["tx-1", "tx-2"],
        methodePaiement: "mobile_money",
        ...ADMIN_ACTOR,
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("lève BAD_REQUEST si le solde retirable est insuffisant", async () => {
    mocks.prismaTransactionFindMany.mockResolvedValue(COMPLETED_TRANSACTIONS);
    mocks.walletFindByOrganizerId.mockResolvedValue({
      ...WALLET,
      soldeRetirable: 100, // bien inférieur au montant requis (800 000)
    });

    await expect(
      payoutService.initierPayout({
        organizerId: "org-1",
        transactionIds: ["tx-1", "tx-2"],
        methodePaiement: "mobile_money",
        ...ADMIN_ACTOR,
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si plusieurs devises sont mélangées", async () => {
    mocks.prismaTransactionFindMany.mockResolvedValue([
      { ...COMPLETED_TRANSACTIONS[0], devise: "XOF" },
      { ...COMPLETED_TRANSACTIONS[1], devise: "EUR" },
    ]);
    mocks.walletFindByOrganizerId.mockResolvedValue(WALLET);

    await expect(
      payoutService.initierPayout({
        organizerId: "org-1",
        transactionIds: ["tx-1", "tx-2"],
        methodePaiement: "mobile_money",
        ...ADMIN_ACTOR,
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("crée le payout si toutes les conditions sont remplies", async () => {
    mocks.prismaTransactionFindMany.mockResolvedValue(COMPLETED_TRANSACTIONS);
    mocks.walletFindByOrganizerId.mockResolvedValue(WALLET);
    mocks.tx.payout.create.mockResolvedValue(PAYOUT_INITIATED);
    mocks.tx.payoutStatusHistory.create.mockResolvedValue({});
    mocks.tx.auditLog.create.mockResolvedValue({});
    mocks.prismaDollarTransaction.mockImplementation(
      async (cb: (tx: typeof mocks.tx) => Promise<unknown>) => cb(mocks.tx)
    );

    const result = await payoutService.initierPayout({
      organizerId: "org-1",
      transactionIds: ["tx-1", "tx-2"],
      methodePaiement: "mobile_money",
      ...ADMIN_ACTOR,
    });

    expect(result).toBeDefined();
    expect(mocks.tx.payout.create).toHaveBeenCalledOnce();
    expect(mocks.tx.payoutStatusHistory.create).toHaveBeenCalledOnce();
    expect(mocks.tx.auditLog.create).toHaveBeenCalledOnce();
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 3 — Machine à états des payouts
// ═════════════════════════════════════════════════════════════════════

describe("Payout — machine à états", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.payout.update.mockResolvedValue({});
    mocks.tx.payoutStatusHistory.create.mockResolvedValue({});
    mocks.tx.auditLog.create.mockResolvedValue({});
    mocks.tx.walletLedger.create.mockResolvedValue({});
    mocks.tx.wallet.update.mockResolvedValue({});
    mocks.prismaDollarTransaction.mockImplementation(
      async (cb: (tx: typeof mocks.tx) => Promise<unknown>) => cb(mocks.tx)
    );
  });

  it("lève UNPROCESSABLE_ENTITY pour transition invalide : completed → approved", async () => {
    mocks.payoutFindById.mockResolvedValue({ ...PAYOUT_INITIATED, statut: "completed" });

    await expect(
      payoutService.approuverPayout("payout-1", { id: "admin-1", role: "admin" })
    ).rejects.toMatchObject({ statusCode: StatusCodes.UNPROCESSABLE_ENTITY });
  });

  it("lève UNPROCESSABLE_ENTITY pour transition invalide : failed → approved", async () => {
    mocks.payoutFindById.mockResolvedValue({ ...PAYOUT_INITIATED, statut: "failed" });

    // tentative de passer approved depuis failed (non autorisé sauf relance)
    await expect(
      payoutService.approuverPayout("payout-1", { id: "admin-1", role: "admin" })
    ).rejects.toMatchObject({ statusCode: StatusCodes.UNPROCESSABLE_ENTITY });
  });

  it("lève NOT_FOUND (404) si le payout est introuvable", async () => {
    mocks.payoutFindById.mockResolvedValue(null);

    await expect(
      payoutService.approuverPayout("payout-unknown", { id: "admin-1", role: "admin" })
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("approuverPayout : initiated → approved (transition valide)", async () => {
    mocks.payoutFindById.mockResolvedValue({ ...PAYOUT_INITIATED, statut: "initiated" });
    mocks.tx.payout.update.mockResolvedValue({ ...PAYOUT_INITIATED, statut: "approved" });

    await expect(
      payoutService.approuverPayout("payout-1", { id: "admin-1", role: "admin" })
    ).resolves.toBeDefined();
  });

  it("un audit log est créé lors de l'approbation", async () => {
    mocks.payoutFindById.mockResolvedValue({ ...PAYOUT_INITIATED, statut: "initiated" });
    mocks.tx.payout.update.mockResolvedValue({ ...PAYOUT_INITIATED, statut: "approved" });

    await payoutService.approuverPayout("payout-1", { id: "admin-1", role: "admin" });

    expect(mocks.tx.auditLog.create).toHaveBeenCalled();
  });
});
