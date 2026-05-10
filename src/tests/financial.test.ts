/**
 * ═══════════════════════════════════════════════════════════════════════
 *  TESTS UNITAIRES — MODULE DE CALCUL FINANCIER
 *  Framework: Vitest
 *  Couverture cible: ≥ 90%
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Pour lancer : npm run test
 *  Pour la couverture : npm run test:coverage
 */

import { describe, it, expect } from "vitest";
import {
  calculerRepartitionFinanciere,
  verifierCohérenceRepartition,
  validerMontantCentimes,
  arrondiHalfUp,
  xofToCentimes,
  centimesToXOF,
  eurToCentimes,
  centimesToEUR,
  formatMontant,
  genererChecksumRepartition,
  genererChecksum,
  agregerRepartitions,
  extractTVA,
  bpToPourcent,
  pourcentToBP,
  TAUX_TVA_BP,
  TAUX_COMMISSION_BP,
  BP_DIVISOR,
} from "../utils/financial.js";

// ─── Constantes de test ───────────────────────────────────────────────
// Billet standard 10 000 XOF = 1 000 000 centimes
const BILLET_10K = 1_000_000; // centimes

// ─── GROUPE 1 : Validation des entrées ───────────────────────────────
describe("validerMontantCentimes", () => {
  it("accepte un entier positif valide", () => {
    const r = validerMontantCentimes(BILLET_10K);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rejette null", () => {
    const r = validerMontantCentimes(null);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/requis/i);
  });

  it("rejette undefined", () => {
    const r = validerMontantCentimes(undefined);
    expect(r.valid).toBe(false);
  });

  it("rejette NaN", () => {
    const r = validerMontantCentimes(NaN);
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/nan/i);
  });

  it("rejette Infinity", () => {
    const r = validerMontantCentimes(Infinity);
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/infinity/i);
  });

  it("rejette -Infinity", () => {
    const r = validerMontantCentimes(-Infinity);
    expect(r.valid).toBe(false);
  });

  it("rejette un float", () => {
    const r = validerMontantCentimes(100.5);
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/entier/i);
  });

  it("rejette 0", () => {
    const r = validerMontantCentimes(0);
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/≥ 1/);
  });

  it("rejette un montant négatif", () => {
    const r = validerMontantCentimes(-100);
    expect(r.valid).toBe(false);
  });

  it("rejette une valeur trop grande (overflow)", () => {
    const r = validerMontantCentimes(1_000_000_000_01); // > 1 milliard XOF
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/dépassement/i);
  });

  it("accepte 1 centime (minimum)", () => {
    expect(validerMontantCentimes(1).valid).toBe(true);
  });

  it("accepte la limite maximale exacte", () => {
    expect(validerMontantCentimes(1_000_000_000_00).valid).toBe(true);
  });

  it("rejette une string", () => {
    const r = validerMontantCentimes("1000" as any);
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/nombre/i);
  });
});

// ─── GROUPE 2 : Arrondi half-up ───────────────────────────────────────
describe("arrondiHalfUp", () => {
  it("arrondit 0.5 vers le haut → 1", () => {
    expect(arrondiHalfUp(0.5)).toBe(1);
  });

  it("arrondit 1.5 vers le haut → 2", () => {
    expect(arrondiHalfUp(1.5)).toBe(2);
  });

  it("arrondit 2.5 vers le haut → 3", () => {
    expect(arrondiHalfUp(2.5)).toBe(3);
  });

  it("arrondit 1.4 vers le bas → 1", () => {
    expect(arrondiHalfUp(1.4)).toBe(1);
  });

  it("arrondit 1.6 vers le haut → 2", () => {
    expect(arrondiHalfUp(1.6)).toBe(2);
  });

  it("arrondit les nombres exacts", () => {
    expect(arrondiHalfUp(100)).toBe(100);
    expect(arrondiHalfUp(0)).toBe(0);
  });

  it("lève une erreur pour Infinity", () => {
    expect(() => arrondiHalfUp(Infinity)).toThrow(/non finie/i);
  });

  it("lève une erreur pour NaN", () => {
    expect(() => arrondiHalfUp(NaN)).toThrow(/non finie/i);
  });
});

// ─── GROUPE 3 : Calcul de répartition — Cas nominal ──────────────────
describe("calculerRepartitionFinanciere — cas nominaux", () => {
  it("calcule correctement pour un billet à 10 000 XOF", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);

    // TTC = 1 000 000 centimes
    expect(r.prixTTC).toBe(BILLET_10K);

    // HT = TTC * 10000 / 11800 = 1000000 * 10000 / 11800 = 847 457.627... → 847 458
    expect(r.prixHT).toBe(847_458);

    // TVA = TTC - HT = 1 000 000 - 847 458 = 152 542
    expect(r.tva).toBe(152_542);

    // Commission = TTC * 10% = 100 000
    expect(r.commission).toBe(100_000);

    // Net = TTC - TVA - Commission = 1 000 000 - 152 542 - 100 000 = 747 458
    expect(r.netOrganisateur).toBe(747_458);

    // Invariant fiscal : HT + TVA = TTC
    expect(r.prixHT + r.tva).toBe(r.prixTTC);
    // Invariant distribution : Net + TVA + Commission = TTC
    expect(r.netOrganisateur + r.tva + r.commission).toBe(r.prixTTC);
  });

  it("vérifie les taux snapshot", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);
    expect(r.tauxTVA).toBe(TAUX_TVA_BP);         // 1800 = 18%
    expect(r.tauxCommission).toBe(TAUX_COMMISSION_BP); // 1000 = 10%
  });

  it("retourne un objet gelé (immuable)", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => { (r as any).prixTTC = 0; }).toThrow();
  });

  it("horodate le calcul (timestamp ISO)", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);
    expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("invariant TTC pour 118 centimes (HT=100 exact)", () => {
    const r = calculerRepartitionFinanciere(118);
    expect(r.prixHT + r.tva).toBe(118);          // fiscal
    expect(r.netOrganisateur + r.tva + r.commission).toBe(118); // distribution
  });
});

// ─── GROUPE 4 : Calcul de répartition — Cas limites d'arrondi ─────────
describe("calculerRepartitionFinanciere — arrondis limites", () => {
  // Test sur des montants où l'arrondi peut différer selon la méthode
  const montantsTest = [1, 100, 101, 117, 118, 119, 999, 1000, 1001, 5000, 11800, 100000, 500000];

  for (const montant of montantsTest) {
    it(`invariant TTC pour ${montant} centimes`, () => {
      const r = calculerRepartitionFinanciere(montant);
      expect(r.prixHT + r.tva).toBe(montant);
      expect(r.netOrganisateur + r.tva + r.commission).toBe(montant);
    });
  }

  it("net organisateur ne peut pas être négatif", () => {
    // Taux commission 100% = impossible via les règles de validation
    const r = calculerRepartitionFinanciere(1000);
    expect(r.netOrganisateur).toBeGreaterThanOrEqual(0);
  });

  it("calcule TVA = 0 si taux TVA = 0 bp", () => {
    const r = calculerRepartitionFinanciere(1000, 0, TAUX_COMMISSION_BP);
    expect(r.prixHT).toBe(1000);
    expect(r.tva).toBe(0);
  });

  it("calcule commission = 0 si taux commission = 0 bp", () => {
    const r = calculerRepartitionFinanciere(1000, TAUX_TVA_BP, 0);
    expect(r.commission).toBe(0);
  });

  it("rejette un taux TVA invalide (> BP_DIVISOR)", () => {
    expect(() => calculerRepartitionFinanciere(1000, 11000, TAUX_COMMISSION_BP)).toThrow();
  });

  it("rejette un taux commission invalide (< 0)", () => {
    expect(() => calculerRepartitionFinanciere(1000, TAUX_TVA_BP, -100)).toThrow();
  });
});

// ─── GROUPE 5 : Vérification de cohérence inverse ─────────────────────
describe("verifierCohérenceRepartition", () => {
  it("valide une répartition correcte", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);
    const check = verifierCohérenceRepartition(r);
    expect(check.coherent).toBe(true);
    expect(check.ecart).toBe(0);
  });

  it("détecte une altération du montant HT", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);
    const altere = { ...r, prixHT: r.prixHT + 1 };
    const check = verifierCohérenceRepartition(altere);
    expect(check.coherent).toBe(false);
  });

  it("détecte une altération de la TVA", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);
    const altere = { ...r, tva: r.tva - 1 };
    const check = verifierCohérenceRepartition(altere);
    expect(check.coherent).toBe(false);
  });

  it("détecte une altération de la commission", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);
    const altere = { ...r, commission: r.commission + 100 };
    const check = verifierCohérenceRepartition(altere);
    expect(check.coherent).toBe(false);
  });

  it("message de succès contient '✅'", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);
    const check = verifierCohérenceRepartition(r);
    expect(check.details).toContain("✅");
  });

  it("message d'erreur contient '❌'", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);
    const altere = { ...r, commission: 0 };
    const check = verifierCohérenceRepartition(altere);
    expect(check.details).toContain("❌");
  });
});

// ─── GROUPE 6 : Conversions devise ────────────────────────────────────
describe("Conversions devise", () => {
  it("xofToCentimes: 10 000 XOF → 1 000 000 centimes", () => {
    expect(xofToCentimes(10_000)).toBe(1_000_000);
  });

  it("xofToCentimes: 0.5 XOF → 50 centimes (arrondi half-up)", () => {
    expect(xofToCentimes(0.005)).toBe(1); // 0.5 centime arrondi à 1
  });

  it("centimesToXOF: 1 000 000 centimes → 10 000 XOF", () => {
    expect(centimesToXOF(1_000_000)).toBe(10_000);
  });

  it("eurToCentimes: 10.99 EUR → 1099 centimes", () => {
    expect(eurToCentimes(10.99)).toBe(1099);
  });

  it("centimesToEUR: 1099 centimes → 10.99 EUR", () => {
    expect(centimesToEUR(1099)).toBe(10.99);
  });

  it("xofToCentimes rejette NaN", () => {
    expect(() => xofToCentimes(NaN)).toThrow();
  });

  it("xofToCentimes rejette Infinity", () => {
    expect(() => xofToCentimes(Infinity)).toThrow();
  });

  it("centimesToXOF rejette un float", () => {
    expect(() => centimesToXOF(100.5)).toThrow(/entier/i);
  });

  it("conversion aller-retour conserve la valeur", () => {
    const original = 10_000;
    const centimes = xofToCentimes(original);
    const retour = centimesToXOF(centimes);
    expect(retour).toBe(original);
  });
});

// ─── GROUPE 7 : Formatage ─────────────────────────────────────────────
describe("formatMontant", () => {
  it("formate en XOF sans décimales", () => {
    const formatted = formatMontant(1_000_000, "XOF");
    // Doit contenir "10" et "000" et "XOF" (ou symbole ₣)
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe("string");
  });

  it("formate en EUR avec 2 décimales", () => {
    const formatted = formatMontant(1099, "EUR");
    expect(formatted).toContain("10");
    expect(formatted).toContain("99");
  });

  it("lève une erreur pour un float", () => {
    expect(() => formatMontant(100.5, "XOF")).toThrow(/entier/i);
  });

  it("gère les devises inconnues avec fallback", () => {
    const formatted = formatMontant(5000, "UNKNOWN");
    expect(formatted).toContain("50"); // 50.00 UNKNOWN
  });
});

// ─── GROUPE 8 : Checksums d'intégrité ─────────────────────────────────
describe("genererChecksumRepartition", () => {
  it("génère un SHA-256 hex de 64 caractères", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);
    const checksum = genererChecksumRepartition(r);
    expect(checksum).toHaveLength(64);
    expect(checksum).toMatch(/^[0-9a-f]+$/);
  });

  it("checksum déterministe pour les mêmes données", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);
    const c1 = genererChecksumRepartition(r);
    const c2 = genererChecksumRepartition(r);
    expect(c1).toBe(c2);
  });

  it("checksum différent pour données différentes", () => {
    const r1 = calculerRepartitionFinanciere(BILLET_10K);
    const r2 = calculerRepartitionFinanciere(200_000); // billet différent
    expect(genererChecksumRepartition(r1)).not.toBe(genererChecksumRepartition(r2));
  });
});

describe("genererChecksum", () => {
  it("est déterministe peu importe l'ordre des clés", () => {
    const c1 = genererChecksum({ a: 1, b: 2 });
    const c2 = genererChecksum({ b: 2, a: 1 });
    expect(c1).toBe(c2);
  });

  it("diffère pour des objets différents", () => {
    const c1 = genererChecksum({ a: 1 });
    const c2 = genererChecksum({ a: 2 });
    expect(c1).not.toBe(c2);
  });
});

// ─── GROUPE 9 : Agrégation ────────────────────────────────────────────
describe("agregerRepartitions", () => {
  it("additionne correctement plusieurs répartitions", () => {
    const r1 = calculerRepartitionFinanciere(BILLET_10K);
    const r2 = calculerRepartitionFinanciere(500_000); // billet 5 000 XOF
    const agg = agregerRepartitions([r1, r2]);

    expect(agg.totalTTC).toBe(r1.prixTTC + r2.prixTTC);
    expect(agg.totalHT).toBe(r1.prixHT + r2.prixHT);
    expect(agg.totalTVA).toBe(r1.tva + r2.tva);
    expect(agg.totalCommission).toBe(r1.commission + r2.commission);
    expect(agg.totalNetOrganisateur).toBe(r1.netOrganisateur + r2.netOrganisateur);
    expect(agg.count).toBe(2);
  });

  it("retourne des zéros pour un tableau vide", () => {
    const agg = agregerRepartitions([]);
    expect(agg.totalTTC).toBe(0);
    expect(agg.count).toBe(0);
  });

  it("invariant distribution : totalNet + totalTVA + totalCommission = totalTTC", () => {
    const montants = [118_00, 236_00, 59_00, 1_000_000];
    const repartitions = montants.map((m) => calculerRepartitionFinanciere(m));
    const agg = agregerRepartitions(repartitions);
    // Distribution : Net + TVA + Commission = TTC
    expect(agg.totalNetOrganisateur + agg.totalTVA + agg.totalCommission).toBe(agg.totalTTC);
    // Fiscal : HT + TVA = TTC
    expect(agg.totalHT + agg.totalTVA).toBe(agg.totalTTC);
  });
});

// ─── GROUPE 10 : Utilitaires de taux ─────────────────────────────────
describe("bpToPourcent / pourcentToBP", () => {
  it("1800 bp → '18.00%'", () => {
    expect(bpToPourcent(1800)).toBe("18.00%");
  });

  it("1000 bp → '10.00%'", () => {
    expect(bpToPourcent(1000)).toBe("10.00%");
  });

  it("0 bp → '0.00%'", () => {
    expect(bpToPourcent(0)).toBe("0.00%");
  });

  it("18% → 1800 bp", () => {
    expect(pourcentToBP(18)).toBe(1800);
  });

  it("10% → 1000 bp", () => {
    expect(pourcentToBP(10)).toBe(1000);
  });

  it("aller-retour bp → pourcent → bp", () => {
    const bp = 1800;
    const pct = parseFloat(bpToPourcent(bp));
    expect(pourcentToBP(pct)).toBe(bp);
  });
});

// ─── GROUPE 11 : extractTVA ───────────────────────────────────────────
describe("extractTVA", () => {
  it("extrait la TVA d'un prix TTC", () => {
    const tva = extractTVA(118);
    expect(tva).toBe(18); // 118 TTC → 100 HT → 18 TVA
  });

  it("correspond à la TVA calculée dans calculerRepartitionFinanciere", () => {
    const r = calculerRepartitionFinanciere(BILLET_10K);
    const tva = extractTVA(BILLET_10K);
    expect(tva).toBe(r.tva);
  });

  it("TVA = 0 si taux = 0", () => {
    expect(extractTVA(1000, 0)).toBe(0);
  });
});

// ─── GROUPE 12 : Valeurs extrêmes et robustesse ───────────────────────
describe("Robustesse — valeurs extrêmes", () => {
  it("calcule correctement pour 1 centime", () => {
    const r = calculerRepartitionFinanciere(1);
    expect(r.prixTTC).toBe(1);
    expect(r.prixHT + r.tva).toBe(1);
    expect(r.netOrganisateur + r.tva + r.commission).toBe(1);
  });

  it("calcule correctement pour un très gros montant", () => {
    const big = 100_000_000_00; // 1 milliard XOF
    const r = calculerRepartitionFinanciere(big);
    expect(r.prixTTC).toBe(big);
    expect(r.prixHT + r.tva).toBe(big);
    expect(r.netOrganisateur + r.tva + r.commission).toBe(big);
  });

  it("l'invariant tient sur 1000 montants aléatoires", () => {
    for (let i = 0; i < 1000; i++) {
      const montant = Math.floor(Math.random() * 10_000_000) + 1;
      const r = calculerRepartitionFinanciere(montant);
      // Invariant fiscal : HT + TVA = TTC
      if (r.prixHT + r.tva !== montant) {
        throw new Error(`INVARIANT FISCAL VIOLÉ pour ${montant}: HT=${r.prixHT} + TVA=${r.tva} = ${r.prixHT + r.tva}`);
      }
      // Invariant distribution : Net + TVA + Commission = TTC
      const distrib = r.netOrganisateur + r.tva + r.commission;
      if (distrib !== montant) {
        throw new Error(`INVARIANT DISTRIB VIOLÉ pour ${montant}: Net=${r.netOrganisateur} + TVA=${r.tva} + Comm=${r.commission} = ${distrib}`);
      }
    }
  });

  it("rejette un montant non entier via calculerRepartitionFinanciere", () => {
    expect(() => calculerRepartitionFinanciere(1000.50)).toThrow();
  });

  it("rejette 0 via calculerRepartitionFinanciere", () => {
    expect(() => calculerRepartitionFinanciere(0)).toThrow();
  });

  it("rejette un montant négatif via calculerRepartitionFinanciere", () => {
    expect(() => calculerRepartitionFinanciere(-100)).toThrow();
  });

  it("rejette NaN via calculerRepartitionFinanciere", () => {
    expect(() => calculerRepartitionFinanciere(NaN)).toThrow();
  });
});

// ─── GROUPE 13 : Exemples métier concrets ─────────────────────────────
describe("Exemples métier concrets", () => {
  it("Billet VIP 50 000 XOF", () => {
    const prixTTC = xofToCentimes(50_000); // 5 000 000 centimes
    const r = calculerRepartitionFinanciere(prixTTC);

    expect(r.prixTTC).toBe(5_000_000);
    // HT ≈ 42 372,88 XOF = 4 237 288 centimes (arrondi)
    // TVA = 18% sur HT
    // Commission = 500 000 centimes (10% de 5 000 000)
    expect(r.commission).toBe(500_000);
    expect(r.prixHT + r.tva).toBe(prixTTC);
    expect(r.netOrganisateur + r.tva + r.commission).toBe(prixTTC);
    expect(r.netOrganisateur).toBeGreaterThan(0);
  });

  it("Billet à 1 180 XOF (HT pile 1 000 XOF)", () => {
    const prixTTC = xofToCentimes(1_180); // 118 000 centimes
    const r = calculerRepartitionFinanciere(prixTTC);

    expect(r.prixHT).toBe(100_000); // HT = exactement 1 000 XOF
    expect(r.tva).toBe(18_000);     // TVA = 180 XOF
    expect(r.commission).toBe(11_800); // Commission = 118 XOF (10% du TTC)
    expect(r.netOrganisateur).toBe(prixTTC - r.tva - r.commission);
  });

  it("100 billets identiques : total = 100 × individuel", () => {
    const prixBillet = 500_000; // 5 000 XOF
    const rUnitaire = calculerRepartitionFinanciere(prixBillet);
    const rTotaux = agregerRepartitions(
      Array.from({ length: 100 }, () => calculerRepartitionFinanciere(prixBillet))
    );

    expect(rTotaux.totalTTC).toBe(rUnitaire.prixTTC * 100);
    expect(rTotaux.totalNetOrganisateur).toBe(rUnitaire.netOrganisateur * 100);
    expect(rTotaux.count).toBe(100);
    // Invariant distribution agrégé
    expect(rTotaux.totalNetOrganisateur + rTotaux.totalTVA + rTotaux.totalCommission).toBe(rTotaux.totalTTC);
  });
});
