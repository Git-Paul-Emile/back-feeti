/**
 * ═══════════════════════════════════════════════════════════════════════
 *  TESTS UNITAIRES — Formules métier Feeti Na Feeti (Fidélité)
 *  Couverture: calculs de points, niveaux, plafonds, partenaires
 *  Aucune dépendance externe — logique pure testée ici.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from "vitest";

// ─── Constantes métier reproduites depuis loyalty.service.ts ─────────
// Ces constantes définissent les règles de gestion du programme fidélité.
// Un changement dans le service DOIT se refléter ici (spec vivante).

const POINTS_PER_100_FCFA = 1;         // 1 pt / 100 FCFA dépensés
const POINT_VALUE_FCFA = 20;            // 1 pt = 20 FCFA de réduction
const POINTS_EVENT_ATTENDANCE = 200;    // présence physique à un événement
const POINTS_SHARE = 20;               // partage d'événement
const POINTS_REFERRAL_SIGNUP = 150;    // parrainage — inscription
const POINTS_REFERRAL_FIRST_EVENT = 300; // parrainage — premier événement filleul
const POINTS_COMMUNITY_POST = 50;
const POINTS_COMMUNITY_LIKE = 5;
const POINTS_COMMUNITY_COMMENT = 10;
const MAX_SHARES_PER_DAY = 10;
const POINTS_CAP_RATIO = 0.5;          // max 50 % du billet payable en points
const MAX_POINTS_PER_1000_FCFA_PARTNER = 1;

// ─── Seuils de niveau (points cumulés) ───────────────────────────────
// Basés sur le document PDF de spec Feeti Na Feeti.
const LEVEL_THRESHOLDS = {
  Mobembo: 0,
  Elengi:  500,
  Momi:    2000,
  Mwana:   5000,
  Boboto:  10000,
};

// ─── Remises partenaires par niveau ──────────────────────────────────
const DEFAULT_PARTNER_DISCOUNTS: Record<string, string> = {
  Mobembo: "5%",
  Elengi:  "10%",
  Momi:    "20%",
  Mwana:   "30%",
  Boboto:  "40%",
};

// ─── Fonctions métier pures ───────────────────────────────────────────

/** Calcule les points gagnés pour un achat de billet. */
function calculateTicketPoints(amountFCFA: number): number {
  return Math.floor(amountFCFA / 100) * POINTS_PER_100_FCFA;
}

/** Simule l'utilisation des points pour un paiement partiel. */
function simulatePointsPayment(availablePoints: number, amountFCFA: number) {
  const maxDiscount = Math.floor(amountFCFA * POINTS_CAP_RATIO);
  const maxPointsUsable = Math.floor(maxDiscount / POINT_VALUE_FCFA);
  const pointsUsable = Math.min(availablePoints, maxPointsUsable);
  const discountFCFA = pointsUsable * POINT_VALUE_FCFA;
  const amountToPay = amountFCFA - discountFCFA;
  return { pointsUsable, discountFCFA, amountToPay, maxPointsUsable };
}

/** Calcule les points gagnés chez un partenaire. */
function calculatePartnerPoints(amountFCFA: number): number {
  return Math.floor(amountFCFA / 1000) * MAX_POINTS_PER_1000_FCFA_PARTNER;
}

/** Détermine le niveau selon les points cumulés. */
function determineLevel(totalPoints: number): string {
  if (totalPoints >= LEVEL_THRESHOLDS.Boboto) return "Boboto";
  if (totalPoints >= LEVEL_THRESHOLDS.Mwana)  return "Mwana";
  if (totalPoints >= LEVEL_THRESHOLDS.Momi)   return "Momi";
  if (totalPoints >= LEVEL_THRESHOLDS.Elengi) return "Elengi";
  return "Mobembo";
}

// ═════════════════════════════════════════════════════════════════════
// GROUPE 1 — Points sur achat de billets
// ═════════════════════════════════════════════════════════════════════

describe("Points — achat de billet (1 pt / 100 FCFA)", () => {

  it("10 000 FCFA → 100 points", () => {
    expect(calculateTicketPoints(10_000)).toBe(100);
  });

  it("5 000 FCFA → 50 points", () => {
    expect(calculateTicketPoints(5_000)).toBe(50);
  });

  it("1 000 FCFA → 10 points", () => {
    expect(calculateTicketPoints(1_000)).toBe(10);
  });

  it("100 FCFA → 1 point (minimum)", () => {
    expect(calculateTicketPoints(100)).toBe(1);
  });

  it("99 FCFA → 0 points (en dessous du seuil)", () => {
    expect(calculateTicketPoints(99)).toBe(0);
  });

  it("0 FCFA → 0 points", () => {
    expect(calculateTicketPoints(0)).toBe(0);
  });

  it("50 000 FCFA → 500 points", () => {
    expect(calculateTicketPoints(50_000)).toBe(500);
  });

  it("150 FCFA → 1 point (troncature par Math.floor)", () => {
    // 150 / 100 = 1.5 → Math.floor(1.5) = 1
    expect(calculateTicketPoints(150)).toBe(1);
  });

  it("199 FCFA → 1 point (troncature)", () => {
    expect(calculateTicketPoints(199)).toBe(1);
  });

  it("200 FCFA → 2 points", () => {
    expect(calculateTicketPoints(200)).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 2 — Constantes actions spéciales
// ═════════════════════════════════════════════════════════════════════

describe("Points — actions spéciales", () => {

  it("présence événement = 200 points", () => {
    expect(POINTS_EVENT_ATTENDANCE).toBe(200);
  });

  it("partage événement = 20 points", () => {
    expect(POINTS_SHARE).toBe(20);
  });

  it("parrainage inscription = 150 points", () => {
    expect(POINTS_REFERRAL_SIGNUP).toBe(150);
  });

  it("parrainage premier événement filleul = 300 points", () => {
    expect(POINTS_REFERRAL_FIRST_EVENT).toBe(300);
  });

  it("post communautaire = 50 points", () => {
    expect(POINTS_COMMUNITY_POST).toBe(50);
  });

  it("like communautaire = 5 points", () => {
    expect(POINTS_COMMUNITY_LIKE).toBe(5);
  });

  it("commentaire communautaire = 10 points", () => {
    expect(POINTS_COMMUNITY_COMMENT).toBe(10);
  });

  it("limite partages journaliers = 10", () => {
    expect(MAX_SHARES_PER_DAY).toBe(10);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 3 — Valeur des points (réduction)
// ═════════════════════════════════════════════════════════════════════

describe("Valeur des points (1 pt = 20 FCFA)", () => {

  it("1 point = 20 FCFA", () => {
    expect(POINT_VALUE_FCFA).toBe(20);
  });

  it("100 points = 2 000 FCFA de réduction", () => {
    expect(100 * POINT_VALUE_FCFA).toBe(2_000);
  });

  it("500 points = 10 000 FCFA de réduction", () => {
    expect(500 * POINT_VALUE_FCFA).toBe(10_000);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 4 — Simulation de paiement avec points (plafond 50 %)
// ═════════════════════════════════════════════════════════════════════

describe("simulatePointsPayment — plafond 50 %", () => {

  it("billet 10 000 FCFA, 500 pts : utilise 250 pts (50 % = 5 000 FCFA ÷ 20)", () => {
    // maxDiscount = 5 000, maxPointsUsable = 5000/20 = 250, pointsUsable = min(500, 250) = 250
    const result = simulatePointsPayment(500, 10_000);
    expect(result.pointsUsable).toBe(250);
    expect(result.discountFCFA).toBe(5_000);
    expect(result.amountToPay).toBe(5_000);
  });

  it("billet 10 000 FCFA, 100 pts : utilise 100 pts (pas de plafond atteint)", () => {
    // maxPointsUsable = 250, min(100, 250) = 100
    const result = simulatePointsPayment(100, 10_000);
    expect(result.pointsUsable).toBe(100);
    expect(result.discountFCFA).toBe(2_000);
    expect(result.amountToPay).toBe(8_000);
  });

  it("billet 5 000 FCFA, 1000 pts : plafond à 125 pts (50 % = 2 500 FCFA ÷ 20)", () => {
    const result = simulatePointsPayment(1_000, 5_000);
    expect(result.maxPointsUsable).toBe(125);
    expect(result.pointsUsable).toBe(125);
    expect(result.discountFCFA).toBe(2_500);
    expect(result.amountToPay).toBe(2_500);
  });

  it("billet 1 000 FCFA, 100 pts : plafond à 25 pts (500 FCFA ÷ 20)", () => {
    const result = simulatePointsPayment(100, 1_000);
    expect(result.maxPointsUsable).toBe(25);
    expect(result.pointsUsable).toBe(25);
    expect(result.discountFCFA).toBe(500);
  });

  it("0 points disponibles → 0 réduction", () => {
    const result = simulatePointsPayment(0, 10_000);
    expect(result.pointsUsable).toBe(0);
    expect(result.discountFCFA).toBe(0);
    expect(result.amountToPay).toBe(10_000);
  });

  it("la réduction ne peut pas dépasser 50 % du montant", () => {
    const result = simulatePointsPayment(100_000, 10_000);
    expect(result.discountFCFA).toBeLessThanOrEqual(10_000 * 0.5);
  });

  it("amountToPay est toujours >= 0", () => {
    const result = simulatePointsPayment(100_000, 1_000);
    expect(result.amountToPay).toBeGreaterThanOrEqual(0);
  });

  it("pointsUsable × POINT_VALUE_FCFA = discountFCFA", () => {
    const result = simulatePointsPayment(200, 8_000);
    expect(result.pointsUsable * POINT_VALUE_FCFA).toBe(result.discountFCFA);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 5 — Points partenaires (1 pt / 1 000 FCFA)
// ═════════════════════════════════════════════════════════════════════

describe("Points partenaires (1 pt / 1 000 FCFA)", () => {

  it("1 000 FCFA → 1 point", () => {
    expect(calculatePartnerPoints(1_000)).toBe(1);
  });

  it("5 000 FCFA → 5 points", () => {
    expect(calculatePartnerPoints(5_000)).toBe(5);
  });

  it("999 FCFA → 0 points (en dessous du seuil)", () => {
    expect(calculatePartnerPoints(999)).toBe(0);
  });

  it("1 500 FCFA → 1 point (troncature)", () => {
    expect(calculatePartnerPoints(1_500)).toBe(1);
  });

  it("10 000 FCFA → 10 points", () => {
    expect(calculatePartnerPoints(10_000)).toBe(10);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 6 — Niveaux de fidélité
// ═════════════════════════════════════════════════════════════════════

describe("Niveaux de fidélité", () => {

  it("0 points → niveau Mobembo", () => {
    expect(determineLevel(0)).toBe("Mobembo");
  });

  it("499 points → niveau Mobembo (seuil Elengi non atteint)", () => {
    expect(determineLevel(499)).toBe("Mobembo");
  });

  it("500 points → niveau Elengi", () => {
    expect(determineLevel(500)).toBe("Elengi");
  });

  it("1 999 points → niveau Elengi", () => {
    expect(determineLevel(1_999)).toBe("Elengi");
  });

  it("2 000 points → niveau Momi", () => {
    expect(determineLevel(2_000)).toBe("Momi");
  });

  it("4 999 points → niveau Momi", () => {
    expect(determineLevel(4_999)).toBe("Momi");
  });

  it("5 000 points → niveau Mwana", () => {
    expect(determineLevel(5_000)).toBe("Mwana");
  });

  it("9 999 points → niveau Mwana", () => {
    expect(determineLevel(9_999)).toBe("Mwana");
  });

  it("10 000 points → niveau Boboto (maximum)", () => {
    expect(determineLevel(10_000)).toBe("Boboto");
  });

  it("999 999 points → niveau Boboto (pas de régression)", () => {
    expect(determineLevel(999_999)).toBe("Boboto");
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 7 — Remises partenaires par niveau
// ═════════════════════════════════════════════════════════════════════

describe("Remises partenaires par niveau", () => {

  it("Mobembo → 5%", () => {
    expect(DEFAULT_PARTNER_DISCOUNTS["Mobembo"]).toBe("5%");
  });

  it("Elengi → 10%", () => {
    expect(DEFAULT_PARTNER_DISCOUNTS["Elengi"]).toBe("10%");
  });

  it("Momi → 20%", () => {
    expect(DEFAULT_PARTNER_DISCOUNTS["Momi"]).toBe("20%");
  });

  it("Mwana → 30%", () => {
    expect(DEFAULT_PARTNER_DISCOUNTS["Mwana"]).toBe("30%");
  });

  it("Boboto → 40%", () => {
    expect(DEFAULT_PARTNER_DISCOUNTS["Boboto"]).toBe("40%");
  });

  it("tous les niveaux ont une remise définie", () => {
    const levels = ["Mobembo", "Elengi", "Momi", "Mwana", "Boboto"];
    for (const level of levels) {
      expect(DEFAULT_PARTNER_DISCOUNTS[level]).toBeDefined();
      expect(DEFAULT_PARTNER_DISCOUNTS[level]).toMatch(/^\d+%$/);
    }
  });

  it("les remises sont croissantes par niveau", () => {
    const values = ["Mobembo", "Elengi", "Momi", "Mwana", "Boboto"]
      .map((l) => parseInt(DEFAULT_PARTNER_DISCOUNTS[l]));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});
