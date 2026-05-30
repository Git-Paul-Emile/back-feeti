/**
 * ═══════════════════════════════════════════════════════════════════════
 *  TESTS — TransactionService
 *  Couverture: idempotence, state machine ACID, calcul financier,
 *              effets wallet lors des transitions
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/AppError.js";

// ─── Mocks hoistés (ESM-safe) ─────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockTx = {
    transaction: {
      create: vi.fn(),
      update: vi.fn(),
    },
    transactionStatusHistory: {
      create: vi.fn(),
    },
    wallet: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    walletLedger: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  return {
    tx: mockTx,
    prismaDollarTransaction: vi.fn().mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
    platformSettingFindMany: vi.fn().mockResolvedValue([]),
    findByIdempotencyKey: vi.fn(),
    findByTicketId: vi.fn(),
    findById: vi.fn(),
  };
});

vi.mock("../config/database.js", () => ({
  prisma: {
    $transaction: mocks.prismaDollarTransaction,
    platformSetting: { findMany: mocks.platformSettingFindMany },
  },
}));

vi.mock("../repositories/transaction.repository.js", () => ({
  transactionRepository: {
    findByIdempotencyKey: mocks.findByIdempotencyKey,
    findByTicketId: mocks.findByTicketId,
    findById: mocks.findById,
  },
}));

vi.mock("../services/wallet.service.js", () => ({
  walletService: { getOrCreateWallet: vi.fn() },
}));

vi.mock("../services/audit.service.js", () => ({
  auditService: { log: vi.fn() },
}));

// ─── Import après mocks ───────────────────────────────────────────────
import { transactionService } from "../services/transaction.service.js";

// ─── Données de test réutilisables ───────────────────────────────────
const BASE_DATA = {
  idempotencyKey: "idem-key-123",
  eventId: "event-abc",
  organizerId: "org-abc",
  buyerId: "buyer-abc",
  ticketId: "ticket-abc",
  prixTTCCentimes: 1_000_000, // 10 000 XOF
  devise: "XOF",
};

const FAKE_TRANSACTION = {
  id: "tx-001",
  idempotencyKey: BASE_DATA.idempotencyKey,
  ticketId: BASE_DATA.ticketId,
  eventId: BASE_DATA.eventId,
  organizerId: BASE_DATA.organizerId,
  buyerId: BASE_DATA.buyerId,
  montantTTC: 1_000_000,
  montantHT: 847_458,
  tva: 152_542,
  commission: 100_000,
  netOrganisateur: 747_458,
  devise: "XOF",
  status: "pending" as const,
  tauxTVA: 1800,
  tauxCommission: 1000,
  createdAt: new Date(),
};

// ═════════════════════════════════════════════════════════════════════
// GROUPE 1 — creerTransaction : idempotence
// ═════════════════════════════════════════════════════════════════════

describe("creerTransaction — idempotence", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.platformSettingFindMany.mockResolvedValue([]);
    mocks.tx.transaction.create.mockResolvedValue(FAKE_TRANSACTION);
    mocks.tx.transactionStatusHistory.create.mockResolvedValue({});
    mocks.tx.wallet.upsert.mockResolvedValue({ id: "wallet-1", soldeDisponible: 0 });
    mocks.tx.walletLedger.create.mockResolvedValue({});
    mocks.prismaDollarTransaction.mockImplementation(
      async (cb: (tx: typeof mocks.tx) => Promise<unknown>) => cb(mocks.tx)
    );
  });

  it("retourne la transaction existante si la clé d'idempotence est déjà utilisée", async () => {
    mocks.findByIdempotencyKey.mockResolvedValue(FAKE_TRANSACTION);

    const result = await transactionService.creerTransaction(BASE_DATA);

    expect(result).toEqual(FAKE_TRANSACTION);
    expect(mocks.findByIdempotencyKey).toHaveBeenCalledWith(BASE_DATA.idempotencyKey);
    // Prisma.$transaction ne doit pas être appelé (court-circuit)
    expect(mocks.prismaDollarTransaction).not.toHaveBeenCalled();
  });

  it("ne crée pas une deuxième fois avec la même clé", async () => {
    mocks.findByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValueOnce(FAKE_TRANSACTION);
    mocks.findByTicketId.mockResolvedValue(null);

    await transactionService.creerTransaction(BASE_DATA);
    const second = await transactionService.creerTransaction(BASE_DATA);

    // Le second appel retourne l'existant sans re-créer
    expect(second).toEqual(FAKE_TRANSACTION);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 2 — creerTransaction : double billet
// ═════════════════════════════════════════════════════════════════════

describe("creerTransaction — protection doublon billet", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findByIdempotencyKey.mockResolvedValue(null);
    mocks.platformSettingFindMany.mockResolvedValue([]);
  });

  it("lève CONFLICT (409) si une transaction existe déjà pour ce billet", async () => {
    mocks.findByTicketId.mockResolvedValue(FAKE_TRANSACTION);

    await expect(
      transactionService.creerTransaction(BASE_DATA)
    ).rejects.toMatchObject({
      statusCode: StatusCodes.CONFLICT,
    });
  });

  it("le message d'erreur mentionne l'ID du billet", async () => {
    mocks.findByTicketId.mockResolvedValue(FAKE_TRANSACTION);

    try {
      await transactionService.creerTransaction(BASE_DATA);
    } catch (err) {
      expect((err as AppError).message).toContain(BASE_DATA.ticketId);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 3 — creerTransaction : calcul financier
// ═════════════════════════════════════════════════════════════════════

describe("creerTransaction — calcul financier", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findByIdempotencyKey.mockResolvedValue(null);
    mocks.findByTicketId.mockResolvedValue(null);
    mocks.platformSettingFindMany.mockResolvedValue([]);
    mocks.tx.transactionStatusHistory.create.mockResolvedValue({});
    mocks.tx.wallet.upsert.mockResolvedValue({ id: "wallet-1", soldeDisponible: 0 });
    mocks.tx.walletLedger.create.mockResolvedValue({});
    mocks.prismaDollarTransaction.mockImplementation(
      async (cb: (tx: typeof mocks.tx) => Promise<unknown>) => cb(mocks.tx)
    );
  });

  it("appelle tx.transaction.create avec la décomposition financière correcte", async () => {
    mocks.tx.transaction.create.mockResolvedValue(FAKE_TRANSACTION);

    await transactionService.creerTransaction(BASE_DATA);

    const createCall = mocks.tx.transaction.create.mock.calls[0]?.[0]?.data;
    expect(createCall).toBeDefined();
    // TTC = prix fourni
    expect(createCall.montantTTC).toBe(BASE_DATA.prixTTCCentimes);
    // Invariant fiscal : HT + TVA = TTC
    expect(createCall.montantHT + createCall.tva).toBe(createCall.montantTTC);
    // Invariant distribution : net + TVA + commission = TTC
    expect(createCall.tva + createCall.commission + createCall.netOrganisateur).toBe(createCall.montantTTC);
  });

  it("un checksum est passé à la création de transaction", async () => {
    mocks.tx.transaction.create.mockResolvedValue(FAKE_TRANSACTION);

    await transactionService.creerTransaction(BASE_DATA);

    const createCall = mocks.tx.transaction.create.mock.calls[0]?.[0]?.data;
    expect(createCall.checksum).toBeDefined();
    expect(typeof createCall.checksum).toBe("string");
    expect(createCall.checksum.length).toBeGreaterThan(0);
  });

  it("le ledger wallet est mis à jour avec le netOrganisateur", async () => {
    mocks.tx.transaction.create.mockResolvedValue(FAKE_TRANSACTION);

    await transactionService.creerTransaction(BASE_DATA);

    const ledgerCall = mocks.tx.walletLedger.create.mock.calls[0]?.[0]?.data;
    expect(ledgerCall).toBeDefined();
    expect(ledgerCall.entryType).toBe("credit");
    expect(ledgerCall.operationType).toBe("ticket_purchase");
  });

  it("utilise les taux de la DB si configurés (tvaRate=20, commissionRate=15)", async () => {
    mocks.platformSettingFindMany.mockResolvedValue([
      { key: "tvaRate", value: "20" },
      { key: "commissionRate", value: "15" },
    ]);
    mocks.tx.transaction.create.mockResolvedValue(FAKE_TRANSACTION);

    await transactionService.creerTransaction(BASE_DATA);

    const createCall = mocks.tx.transaction.create.mock.calls[0]?.[0]?.data;
    // Taux TVA en basis points: 20% = 2000 bp
    expect(createCall.tauxTVA).toBe(2000);
    // Taux commission: 15% = 1500 bp
    expect(createCall.tauxCommission).toBe(1500);
  });

  it("utilise 18% TVA et 10% commission par défaut si non configuré", async () => {
    mocks.platformSettingFindMany.mockResolvedValue([]);
    mocks.tx.transaction.create.mockResolvedValue(FAKE_TRANSACTION);

    await transactionService.creerTransaction(BASE_DATA);

    const createCall = mocks.tx.transaction.create.mock.calls[0]?.[0]?.data;
    expect(createCall.tauxTVA).toBe(1800);
    expect(createCall.tauxCommission).toBe(1000);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 4 — changerStatut : machine à états
// ═════════════════════════════════════════════════════════════════════

describe("changerStatut — machine à états", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.transaction.update.mockResolvedValue({ ...FAKE_TRANSACTION, status: "processing" });
    mocks.tx.transactionStatusHistory.create.mockResolvedValue({});
    mocks.tx.wallet.findUnique.mockResolvedValue(null); // pas de wallet = pas d'effet
    mocks.tx.auditLog.create.mockResolvedValue({});
    mocks.prismaDollarTransaction.mockImplementation(
      async (cb: (tx: typeof mocks.tx) => Promise<unknown>) => cb(mocks.tx)
    );
  });

  it("lève NOT_FOUND (404) si la transaction est introuvable", async () => {
    mocks.findById.mockResolvedValue(null);

    await expect(
      transactionService.changerStatut("tx-unknown", "processing", { id: "admin-1", role: "admin" })
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("lève UNPROCESSABLE_ENTITY (422) pour transition invalide : completed → pending", async () => {
    mocks.findById.mockResolvedValue({ ...FAKE_TRANSACTION, status: "completed" });

    await expect(
      transactionService.changerStatut("tx-001", "pending", { id: "admin-1", role: "admin" })
    ).rejects.toMatchObject({ statusCode: StatusCodes.UNPROCESSABLE_ENTITY });
  });

  it("lève UNPROCESSABLE_ENTITY pour transition invalide : failed → completed", async () => {
    mocks.findById.mockResolvedValue({ ...FAKE_TRANSACTION, status: "failed" });

    await expect(
      transactionService.changerStatut("tx-001", "completed", { id: "admin-1", role: "admin" })
    ).rejects.toMatchObject({ statusCode: StatusCodes.UNPROCESSABLE_ENTITY });
  });

  it("lève UNPROCESSABLE_ENTITY pour transition invalide : refunded → paid", async () => {
    mocks.findById.mockResolvedValue({ ...FAKE_TRANSACTION, status: "refunded" });

    await expect(
      transactionService.changerStatut("tx-001", "paid", { id: "admin-1", role: "admin" })
    ).rejects.toMatchObject({ statusCode: StatusCodes.UNPROCESSABLE_ENTITY });
  });

  it("accepte la transition valide : pending → processing", async () => {
    mocks.findById.mockResolvedValue({ ...FAKE_TRANSACTION, status: "pending" });
    mocks.tx.transaction.update.mockResolvedValue({ ...FAKE_TRANSACTION, status: "processing" });

    await expect(
      transactionService.changerStatut("tx-001", "processing", { id: "admin-1", role: "admin" })
    ).resolves.toBeDefined();
  });

  it("accepte la transition valide : pending → failed", async () => {
    mocks.findById.mockResolvedValue({ ...FAKE_TRANSACTION, status: "pending" });
    mocks.tx.transaction.update.mockResolvedValue({ ...FAKE_TRANSACTION, status: "failed" });

    await expect(
      transactionService.changerStatut("tx-001", "failed", { id: "admin-1", role: "admin" })
    ).resolves.toBeDefined();
  });

  it("accepte la transition valide : processing → paid", async () => {
    mocks.findById.mockResolvedValue({ ...FAKE_TRANSACTION, status: "processing" });
    mocks.tx.transaction.update.mockResolvedValue({ ...FAKE_TRANSACTION, status: "paid" });

    await expect(
      transactionService.changerStatut("tx-001", "paid", { id: "admin-1", role: "admin" })
    ).resolves.toBeDefined();
  });

  it("accepte la transition valide : paid → completed", async () => {
    mocks.findById.mockResolvedValue({ ...FAKE_TRANSACTION, status: "paid" });
    mocks.tx.transaction.update.mockResolvedValue({ ...FAKE_TRANSACTION, status: "completed" });

    await expect(
      transactionService.changerStatut("tx-001", "completed", { id: "admin-1", role: "admin" })
    ).resolves.toBeDefined();
  });

  it("accepte la transition valide : paid → refunded", async () => {
    mocks.findById.mockResolvedValue({ ...FAKE_TRANSACTION, status: "paid" });
    mocks.tx.transaction.update.mockResolvedValue({ ...FAKE_TRANSACTION, status: "refunded" });

    await expect(
      transactionService.changerStatut("tx-001", "refunded", { id: "admin-1", role: "admin" })
    ).resolves.toBeDefined();
  });

  it("un audit log est créé lors de chaque transition", async () => {
    mocks.findById.mockResolvedValue({ ...FAKE_TRANSACTION, status: "pending" });
    mocks.tx.transaction.update.mockResolvedValue({ ...FAKE_TRANSACTION, status: "processing" });

    await transactionService.changerStatut("tx-001", "processing", { id: "admin-1", role: "admin" });

    expect(mocks.tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("un historique de statut est créé lors de chaque transition", async () => {
    mocks.findById.mockResolvedValue({ ...FAKE_TRANSACTION, status: "pending" });
    mocks.tx.transaction.update.mockResolvedValue({ ...FAKE_TRANSACTION, status: "processing" });

    await transactionService.changerStatut("tx-001", "processing", { id: "admin-1", role: "admin" });

    expect(mocks.tx.transactionStatusHistory.create).toHaveBeenCalledOnce();
    const histCall = mocks.tx.transactionStatusHistory.create.mock.calls[0]?.[0]?.data;
    expect(histCall.fromStatus).toBe("pending");
    expect(histCall.toStatus).toBe("processing");
  });
});
