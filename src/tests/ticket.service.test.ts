/**
 * ═══════════════════════════════════════════════════════════════════════
 *  TESTS — TicketService
 *  Couverture: achat (guards métier), vérification QR,
 *              remboursement, limite de billets par utilisateur
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";

// ─── Mocks hoistés ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  eventFindById: vi.fn(),
  ticketCreate: vi.fn(),
  ticketFindById: vi.fn(),
  ticketFindByQrData: vi.fn(),
  ticketCountByUserAndEvent: vi.fn(),
  ticketFindByUser: vi.fn(),
  ticketUpdateStatus: vi.fn(),
  ticketUpdateRefundRequest: vi.fn(),
  eventUpdate: vi.fn(),
  deliveryZoneFindUnique: vi.fn(),
  deliveryAddressCreate: vi.fn(),
  eventServiceGetById: vi.fn(),
  prismaTicketFindUnique: vi.fn().mockResolvedValue(null),
  prismaTicketFindFirst: vi.fn().mockResolvedValue(null),
}));

vi.mock("../repositories/event.repository.js", () => ({
  eventRepository: {
    findById: mocks.eventFindById,
    update: mocks.eventUpdate,
  },
}));

vi.mock("../repositories/ticket.repository.js", () => ({
  ticketRepository: {
    create: mocks.ticketCreate,
    findById: mocks.ticketFindById,
    findByQrData: mocks.ticketFindByQrData,
    countByUserAndEvent: mocks.ticketCountByUserAndEvent,
    findByUser: mocks.ticketFindByUser,
    updateStatus: mocks.ticketUpdateStatus,
    updateRefundRequest: mocks.ticketUpdateRefundRequest,
  },
}));

vi.mock("../services/event.service.js", () => ({
  eventService: {
    getEventById: mocks.eventServiceGetById,
  },
}));

vi.mock("../config/database.js", () => ({
  prisma: {
    deliveryZone: { findUnique: mocks.deliveryZoneFindUnique },
    deliveryAddress: { create: mocks.deliveryAddressCreate },
    ticket: { findUnique: mocks.prismaTicketFindUnique, findFirst: mocks.prismaTicketFindFirst },
  },
}));

import { ticketService } from "../services/ticket.service.js";

// ─── Données de test ──────────────────────────────────────────────────

// Date future (dans 30 jours)
const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const FUTURE_DATE_STR = FUTURE_DATE.toISOString().split("T")[0]; // "2026-06-29"

const PUBLISHED_EVENT = {
  id: "event-1",
  title: "Concert Feeti",
  date: FUTURE_DATE_STR,
  time: "20:00",
  status: "published",
  attendees: 50,
  maxAttendees: 200,
  currency: "XOF",
  organizerId: "org-1",
  salesBlocked: false,
};

const PURCHASE_DATA = {
  eventId: "event-1",
  userId: "buyer-1",
  holderName: "Acheteur Test",
  holderEmail: "acheteur@test.cm",
  items: [{ category: "standard", quantity: 1, price: 500_000 }],
};

const FAKE_TICKET = {
  id: "ticket-1",
  eventId: "event-1",
  userId: "buyer-1",
  category: "standard",
  price: 500_000,
  status: "valid" as const,
  qrData: '{"ticketId":"ticket-1","orderId":"order-1","eventId":"event-1","timestamp":1234,"signature":"abcd"}',
  holderName: "Acheteur Test",
  holderEmail: "acheteur@test.cm",
  event: { organizerId: "org-1" },
};

// ═════════════════════════════════════════════════════════════════════
// GROUPE 1 — purchaseTickets : guards métier
// ═════════════════════════════════════════════════════════════════════

describe("purchaseTickets — guards métier", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ticketCountByUserAndEvent.mockResolvedValue(0);
    mocks.ticketCreate.mockResolvedValue(FAKE_TICKET);
    mocks.eventUpdate.mockResolvedValue({});
    mocks.deliveryAddressCreate.mockResolvedValue({});
  });

  it("lève NOT_FOUND (404) si l'événement est introuvable", async () => {
    mocks.eventFindById.mockResolvedValue(null);

    await expect(
      ticketService.purchaseTickets(PURCHASE_DATA)
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("lève BAD_REQUEST (400) si l'événement n'est pas publié", async () => {
    mocks.eventFindById.mockResolvedValue({ ...PUBLISHED_EVENT, status: "draft" });

    await expect(
      ticketService.purchaseTickets(PURCHASE_DATA)
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si la date de l'événement est passée", async () => {
    // Date du passé
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pastDateStr = pastDate.toISOString().split("T")[0];
    mocks.eventFindById.mockResolvedValue({
      ...PUBLISHED_EVENT,
      date: pastDateStr,
      time: "00:00",
    });

    await expect(
      ticketService.purchaseTickets(PURCHASE_DATA)
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si la vente est bloquée par l'organisateur", async () => {
    mocks.eventFindById.mockResolvedValue({ ...PUBLISHED_EVENT, salesBlocked: true });

    await expect(
      ticketService.purchaseTickets(PURCHASE_DATA)
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si la capacité maximale est atteinte", async () => {
    mocks.eventFindById.mockResolvedValue({
      ...PUBLISHED_EVENT,
      attendees: 200,
      maxAttendees: 200,
    });

    await expect(
      ticketService.purchaseTickets(PURCHASE_DATA)
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si l'achat dépasserait la capacité maximale", async () => {
    mocks.eventFindById.mockResolvedValue({
      ...PUBLISHED_EVENT,
      attendees: 199,
      maxAttendees: 200,
    });
    // Tente d'acheter 2 billets alors qu'il n'en reste qu'1
    await expect(
      ticketService.purchaseTickets({
        ...PURCHASE_DATA,
        items: [{ category: "standard", quantity: 2, price: 500_000 }],
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si l'utilisateur a déjà atteint la limite de 3 billets", async () => {
    mocks.eventFindById.mockResolvedValue(PUBLISHED_EVENT);
    mocks.ticketCountByUserAndEvent.mockResolvedValue(3); // limite atteinte

    await expect(
      ticketService.purchaseTickets(PURCHASE_DATA)
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si l'achat dépasserait la limite de 3 billets", async () => {
    mocks.eventFindById.mockResolvedValue(PUBLISHED_EVENT);
    mocks.ticketCountByUserAndEvent.mockResolvedValue(2); // 2 déjà achetés

    await expect(
      ticketService.purchaseTickets({
        ...PURCHASE_DATA,
        items: [{ category: "standard", quantity: 2, price: 500_000 }], // essaie d'en ajouter 2 → total = 4
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("crée le billet si toutes les conditions sont valides", async () => {
    mocks.eventFindById.mockResolvedValue(PUBLISHED_EVENT);
    mocks.ticketCountByUserAndEvent.mockResolvedValue(0);

    const result = await ticketService.purchaseTickets(PURCHASE_DATA);

    expect(result.tickets).toBeDefined();
    expect(result.tickets.length).toBeGreaterThan(0);
    expect(result.orderId).toBeDefined();
  });

  it("incrémente le compteur d'attendees sur l'événement", async () => {
    mocks.eventFindById.mockResolvedValue(PUBLISHED_EVENT);

    await ticketService.purchaseTickets(PURCHASE_DATA);

    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      PUBLISHED_EVENT.id,
      { attendees: PUBLISHED_EVENT.attendees + 1 }
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 2 — purchaseTickets : livraison physique
// ═════════════════════════════════════════════════════════════════════

describe("purchaseTickets — livraison physique", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eventFindById.mockResolvedValue(PUBLISHED_EVENT);
    mocks.ticketCountByUserAndEvent.mockResolvedValue(0);
    mocks.ticketCreate.mockResolvedValue(FAKE_TICKET);
    mocks.eventUpdate.mockResolvedValue({});
    mocks.deliveryAddressCreate.mockResolvedValue({});
  });

  it("lève BAD_REQUEST si la livraison physique est choisie sans zone", async () => {
    await expect(
      ticketService.purchaseTickets({
        ...PURCHASE_DATA,
        delivery: { method: "physical" }, // zoneId manquant
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si la livraison physique est choisie sans nom du destinataire", async () => {
    await expect(
      ticketService.purchaseTickets({
        ...PURCHASE_DATA,
        delivery: {
          method: "physical",
          zoneId: "zone-1",
          recipientPhone: "+237600000000",
          // recipientName manquant
        },
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève NOT_FOUND si la zone de livraison n'existe pas", async () => {
    mocks.deliveryZoneFindUnique.mockResolvedValue(null);

    await expect(
      ticketService.purchaseTickets({
        ...PURCHASE_DATA,
        delivery: {
          method: "physical",
          zoneId: "zone-unknown",
          recipientName: "Destinataire Test",
          recipientPhone: "+237600000000",
        },
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("crée une adresse de livraison si la zone est valide", async () => {
    mocks.deliveryZoneFindUnique.mockResolvedValue({ id: "zone-1", fee: 2000 });

    await ticketService.purchaseTickets({
      ...PURCHASE_DATA,
      delivery: {
        method: "physical",
        zoneId: "zone-1",
        recipientName: "Destinataire Test",
        recipientPhone: "+237600000000",
      },
    });

    expect(mocks.deliveryAddressCreate).toHaveBeenCalledOnce();
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 3 — verifyTicket : validation QR
// ═════════════════════════════════════════════════════════════════════

describe("verifyTicket — validation du QR", () => {

  beforeEach(() => vi.clearAllMocks());

  it("lève NOT_FOUND si le QR ne correspond à aucun billet", async () => {
    mocks.ticketFindByQrData.mockResolvedValue(null);

    await expect(
      ticketService.verifyTicket('{"invalid":"qr"}', "org-1")
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("lève FORBIDDEN si l'organisateur n'est pas propriétaire de l'événement", async () => {
    mocks.ticketFindByQrData.mockResolvedValue({
      ...FAKE_TICKET,
      event: { organizerId: "org-owner" }, // un autre organisateur
    });

    await expect(
      ticketService.verifyTicket(FAKE_TICKET.qrData, "org-intrus")
    ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
  });

  it("lève BAD_REQUEST si le billet a déjà été utilisé", async () => {
    mocks.ticketFindByQrData.mockResolvedValue({ ...FAKE_TICKET, status: "used" });

    await expect(
      ticketService.verifyTicket(FAKE_TICKET.qrData, "org-1")
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si le billet est expiré", async () => {
    mocks.ticketFindByQrData.mockResolvedValue({ ...FAKE_TICKET, status: "expired" });

    await expect(
      ticketService.verifyTicket(FAKE_TICKET.qrData, "org-1")
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si le billet n'est pas dans le statut 'valid'", async () => {
    mocks.ticketFindByQrData.mockResolvedValue({ ...FAKE_TICKET, status: "refunded" });

    await expect(
      ticketService.verifyTicket(FAKE_TICKET.qrData, "org-1")
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("valide le billet et passe son statut à 'used'", async () => {
    mocks.ticketFindByQrData.mockResolvedValue(FAKE_TICKET);
    mocks.ticketUpdateStatus.mockResolvedValue({ ...FAKE_TICKET, status: "used" });

    const result = await ticketService.verifyTicket(FAKE_TICKET.qrData, "org-1");

    expect(mocks.ticketUpdateStatus).toHaveBeenCalledWith(FAKE_TICKET.id, "used", expect.any(Date));
    expect(result.message).toMatch(/succès/i);
  });

  it("un admin peut valider n'importe quel billet (bypass organisateur)", async () => {
    mocks.ticketFindByQrData.mockResolvedValue(FAKE_TICKET);
    mocks.ticketUpdateStatus.mockResolvedValue({ ...FAKE_TICKET, status: "used" });

    await expect(
      ticketService.verifyTicket(FAKE_TICKET.qrData, "some-admin-id", "admin")
    ).resolves.toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 4 — requestRefund : demande de remboursement
// ═════════════════════════════════════════════════════════════════════

describe("requestRefund — demande de remboursement", () => {

  beforeEach(() => vi.clearAllMocks());

  it("lève NOT_FOUND si le billet est introuvable", async () => {
    mocks.ticketFindById.mockResolvedValue(null);

    await expect(
      ticketService.requestRefund("ticket-unknown", "buyer-1", "Je change d'avis")
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("lève FORBIDDEN si l'utilisateur n'est pas le propriétaire", async () => {
    mocks.ticketFindById.mockResolvedValue({ ...FAKE_TICKET, userId: "other-user" });

    await expect(
      ticketService.requestRefund("ticket-1", "buyer-1", "raison")
    ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
  });

  it("lève BAD_REQUEST si le billet a déjà été utilisé", async () => {
    mocks.ticketFindById.mockResolvedValue({ ...FAKE_TICKET, status: "used" });

    await expect(
      ticketService.requestRefund("ticket-1", "buyer-1", "raison")
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si une demande est déjà en cours", async () => {
    mocks.ticketFindById.mockResolvedValue({ ...FAKE_TICKET, status: "refund_requested" });

    await expect(
      ticketService.requestRefund("ticket-1", "buyer-1", "raison")
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("lève BAD_REQUEST si le billet a déjà été remboursé", async () => {
    mocks.ticketFindById.mockResolvedValue({ ...FAKE_TICKET, status: "refunded" });

    await expect(
      ticketService.requestRefund("ticket-1", "buyer-1", "raison")
    ).rejects.toMatchObject({ statusCode: StatusCodes.BAD_REQUEST });
  });

  it("enregistre la demande de remboursement si le billet est valide", async () => {
    mocks.ticketFindById.mockResolvedValue(FAKE_TICKET);
    mocks.ticketUpdateRefundRequest.mockResolvedValue({
      ...FAKE_TICKET,
      status: "refund_requested",
      refundReason: "raison",
    });

    await ticketService.requestRefund("ticket-1", "buyer-1", "raison");

    expect(mocks.ticketUpdateRefundRequest).toHaveBeenCalledWith("ticket-1", "raison");
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 5 — getTicketById : contrôle d'accès
// ═════════════════════════════════════════════════════════════════════

describe("getTicketById — contrôle d'accès", () => {

  beforeEach(() => vi.clearAllMocks());

  it("lève NOT_FOUND si le billet est introuvable", async () => {
    mocks.ticketFindById.mockResolvedValue(null);

    await expect(
      ticketService.getTicketById("unknown", "buyer-1")
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("lève FORBIDDEN si l'utilisateur ne possède pas le billet", async () => {
    mocks.ticketFindById.mockResolvedValue({ ...FAKE_TICKET, userId: "autre-user" });

    await expect(
      ticketService.getTicketById("ticket-1", "buyer-1")
    ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
  });

  it("retourne le billet si l'utilisateur en est propriétaire", async () => {
    mocks.ticketFindById.mockResolvedValue(FAKE_TICKET);

    const result = await ticketService.getTicketById("ticket-1", "buyer-1");

    expect(result.id).toBe("ticket-1");
  });

  it("un admin peut accéder à n'importe quel billet", async () => {
    mocks.ticketFindById.mockResolvedValue({ ...FAKE_TICKET, userId: "autre-user" });

    await expect(
      ticketService.getTicketById("ticket-1", "admin-1", "admin")
    ).resolves.toBeDefined();
  });
});
