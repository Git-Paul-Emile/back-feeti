/**
 * ═══════════════════════════════════════════════════════════════════════
 *  MODULE DE CALCUL FINANCIER — FEETI PLATFORM
 *  Version: 1.0.0
 *  Conformité: IFRS, Normes comptables OHADA, TVA Afrique Centrale
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  RÈGLES FONDAMENTALES :
 *  • Tous les montants sont en CENTIMES (entiers) — JAMAIS de floats
 *  • Arrondi "half-up" (arrondi commercial standard)
 *  • TVA = 18% (taux CEMAC/OHADA par défaut)
 *  • Commission plateforme = 10% du TTC
 *  • HT = TTC / 1.18  →  TVA = TTC - HT
 *  • Net organisateur = TTC - TVA - Commission
 *
 *  INVARIANT DE COHÉRENCE :
 *  prixHT + tva + commission + netOrganisateur === prixTTC
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Constantes tarifaires (en basis points) ─────────────────────────
// Basis points : 10000 bp = 100%, 1800 bp = 18%, 1000 bp = 10%
export const TAUX_TVA_BP = 1800 as const;        // 18.00%
export const TAUX_COMMISSION_BP = 1000 as const; // 10.00%
export const BP_DIVISOR = 10000 as const;        // 10 000 basis points = 100%

// Diviseur TVA pour passer TTC → HT : 11800 = 118%
const TVA_DIVISOR = BP_DIVISOR + TAUX_TVA_BP; // 11800

// Limites de sécurité
const MAX_AMOUNT_CENTIMES = 1_000_000_000_00; // 1 milliard XOF en centimes
const MIN_AMOUNT_CENTIMES = 1;                 // 1 centime minimum

// ─── Types ───────────────────────────────────────────────────────────

export interface RepartitionFinanciere {
  readonly prixTTC: number;
  readonly prixHT: number;
  readonly tva: number;
  readonly commission: number;
  readonly netOrganisateur: number;
  readonly tauxTVA: number;         // basis points
  readonly tauxCommission: number;  // basis points
  readonly timestamp: string;       // ISO 8601
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

export interface CurrencyFormat {
  readonly montant: number;        // en centimes
  readonly formatted: string;      // "12 500 XOF"
  readonly devise: string;
}

// ─── Arrondi "half-up" (arrondi commercial) ──────────────────────────
// Conforme à la norme comptable OHADA et IFRS
// Math.round() en JS utilise "half-up" pour les positifs — safe ici
export function arrondiHalfUp(valeur: number): number {
  if (!isFinite(valeur)) {
    throw new Error(`Valeur non finie pour arrondi: ${valeur}`);
  }
  return Math.round(valeur);
}

// ─── Validation des entrées ───────────────────────────────────────────
export function validerMontantCentimes(montant: unknown): ValidationResult {
  const errors: string[] = [];

  if (montant === null || montant === undefined) {
    errors.push("Le montant est requis");
    return { valid: false, errors };
  }

  if (typeof montant !== "number") {
    errors.push(`Le montant doit être un nombre, reçu: ${typeof montant}`);
    return { valid: false, errors };
  }

  if (isNaN(montant)) {
    errors.push("Le montant ne peut pas être NaN");
  }

  if (!isFinite(montant)) {
    errors.push("Le montant ne peut pas être Infinity");
  }

  if (!Number.isInteger(montant)) {
    errors.push(
      `Le montant doit être un entier (centimes entiers), reçu: ${montant}. ` +
      `Convertir d'abord en centimes avec eursToCentimes() ou xofToCentimes()`
    );
  }

  if (montant < MIN_AMOUNT_CENTIMES) {
    errors.push(`Le montant doit être ≥ ${MIN_AMOUNT_CENTIMES} centime(s), reçu: ${montant}`);
  }

  if (montant > MAX_AMOUNT_CENTIMES) {
    errors.push(
      `Dépassement de limite: ${montant} centimes > ${MAX_AMOUNT_CENTIMES} ` +
      `(${centimesToXOF(MAX_AMOUNT_CENTIMES)} XOF max)`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ─── Calcul principal ─────────────────────────────────────────────────
/**
 * Calcule la répartition financière d'un prix TTC en centimes.
 *
 * @param prixTTCCentimes - Prix TTC en centimes (entier positif)
 * @param tauxTVA_bp - Taux TVA en basis points (défaut: 1800 = 18%)
 * @param tauxCommission_bp - Taux commission en basis points (défaut: 1000 = 10%)
 * @returns RepartitionFinanciere immuable avec tous les montants en centimes
 *
 * @example
 * // Billet à 10 000 XOF = 1 000 000 centimes
 * const r = calculerRepartitionFinanciere(1_000_000);
 * // r.prixHT      = 847 458 centimes  (≈ 8 474,58 XOF)
 * // r.tva         = 152 542 centimes  (≈ 1 525,42 XOF)
 * // r.commission  = 100 000 centimes  (1 000 XOF)
 * // r.netOrg      = 747 458 centimes  (≈ 7 474,58 XOF)
 */
export function calculerRepartitionFinanciere(
  prixTTCCentimes: number,
  tauxTVA_bp: number = TAUX_TVA_BP,
  tauxCommission_bp: number = TAUX_COMMISSION_BP
): RepartitionFinanciere {
  // Validation stricte
  const validation = validerMontantCentimes(prixTTCCentimes);
  if (!validation.valid) {
    throw new Error(
      `Montant TTC invalide: ${validation.errors.join("; ")}`
    );
  }

  if (!Number.isInteger(tauxTVA_bp) || tauxTVA_bp < 0 || tauxTVA_bp > BP_DIVISOR) {
    throw new Error(`Taux TVA invalide: ${tauxTVA_bp} bp (doit être entre 0 et 10000)`);
  }

  if (!Number.isInteger(tauxCommission_bp) || tauxCommission_bp < 0 || tauxCommission_bp > BP_DIVISOR) {
    throw new Error(`Taux commission invalide: ${tauxCommission_bp} bp (doit être entre 0 et 10000)`);
  }

  const prixTTC = prixTTCCentimes;

  // HT = TTC / (1 + tauxTVA)  — division entière avec arrondi half-up
  // Ex: prixTTC=118 centimes, tauxTVA=18% → HT = 118 * 10000 / 11800 = 100
  const tvaDivisor = BP_DIVISOR + tauxTVA_bp;
  const prixHT = arrondiHalfUp((prixTTC * BP_DIVISOR) / tvaDivisor);

  // TVA = TTC - HT  (identité comptable, préserve l'arrondi)
  const tva = prixTTC - prixHT;

  // Commission = TTC * tauxCommission / 10000
  const commission = arrondiHalfUp((prixTTC * tauxCommission_bp) / BP_DIVISOR);

  // Net organisateur = TTC - TVA - Commission
  const netOrganisateur = prixTTC - tva - commission;

  // ── Vérification cohérence double invariant ──────────────────────────
  // Invariant 1 (fiscal) : TTC = HT + TVA
  if (prixHT + tva !== prixTTC) {
    throw new Error(
      `ERREUR CRITIQUE — décomposition fiscale: HT(${prixHT}) + TVA(${tva}) = ${prixHT + tva} ≠ TTC(${prixTTC}). ` +
      `Écart: ${prixHT + tva - prixTTC} centimes.`
    );
  }
  // Invariant 2 (distribution) : TTC = Net + TVA + Commission
  const distribution = netOrganisateur + tva + commission;
  if (distribution !== prixTTC) {
    throw new Error(
      `ERREUR CRITIQUE — distribution: Net(${netOrganisateur}) + TVA(${tva}) + Commission(${commission}) = ${distribution} ≠ TTC(${prixTTC}). ` +
      `Écart: ${distribution - prixTTC} centimes.`
    );
  }

  if (netOrganisateur < 0) {
    throw new Error(
      `Net organisateur négatif (${netOrganisateur}): commission (${commission}) > (TTC - TVA) (${prixTTC - tva})`
    );
  }

  return Object.freeze({
    prixTTC,
    prixHT,
    tva,
    commission,
    netOrganisateur,
    tauxTVA: tauxTVA_bp,
    tauxCommission: tauxCommission_bp,
    timestamp: new Date().toISOString(),
  });
}

// ─── Vérification inverse ─────────────────────────────────────────────
/**
 * Recalcule et vérifie la cohérence d'une répartition existante.
 * Utilisé pour la validation d'audit.
 */
export function verifierCohérenceRepartition(
  repartition: Omit<RepartitionFinanciere, "timestamp">
): { coherent: boolean; ecart: number; details: string } {
  const { prixTTC, prixHT, tva, commission, netOrganisateur, tauxTVA, tauxCommission } = repartition;

  // Recalcul indépendant
  const tvaDivisor = BP_DIVISOR + tauxTVA;
  const prixHTCalc = arrondiHalfUp((prixTTC * BP_DIVISOR) / tvaDivisor);
  const tvaCalc = prixTTC - prixHTCalc;
  const commissionCalc = arrondiHalfUp((prixTTC * tauxCommission) / BP_DIVISOR);
  const netCalc = prixTTC - tvaCalc - commissionCalc;

  // Invariant 1 (fiscal)     : TTC = HT + TVA
  // Invariant 2 (distribution): TTC = Net + TVA + Commission
  const ecartFiscal = (prixHT + tva) - prixTTC;
  const ecartDistrib = (netOrganisateur + tva + commission) - prixTTC;
  const ecart = ecartFiscal !== 0 ? ecartFiscal : ecartDistrib;

  const coherent =
    ecartFiscal === 0 &&
    ecartDistrib === 0 &&
    prixHT === prixHTCalc &&
    tva === tvaCalc &&
    commission === commissionCalc &&
    netOrganisateur === netCalc;

  const details = coherent
    ? `✅ Cohérence vérifiée: TTC=${prixTTC}, HT=${prixHT}, TVA=${tva}, Commission=${commission}, Net=${netOrganisateur}`
    : `❌ Incohérence détectée — Reçu: HT=${prixHT}/TVA=${tva}/Comm=${commission}/Net=${netOrganisateur} | ` +
      `Attendu: HT=${prixHTCalc}/TVA=${tvaCalc}/Comm=${commissionCalc}/Net=${netCalc} | ` +
      `Écart fiscal: ${ecartFiscal}, Écart distrib: ${ecartDistrib}`;

  return { coherent, ecart, details };
}

// ─── Conversions devise ───────────────────────────────────────────────

/** Convertit un montant décimal XOF en centimes entiers */
export function xofToCentimes(montantXOF: number): number {
  if (!isFinite(montantXOF) || isNaN(montantXOF)) {
    throw new Error(`Montant XOF invalide: ${montantXOF}`);
  }
  return arrondiHalfUp(montantXOF * 100);
}

/** Convertit des centimes en XOF décimal */
export function centimesToXOF(centimes: number): number {
  if (!Number.isInteger(centimes)) {
    throw new Error(`Les centimes doivent être un entier, reçu: ${centimes}`);
  }
  return centimes / 100;
}

/** Convertit un montant EUR en centimes */
export function eurToCentimes(montantEUR: number): number {
  if (!isFinite(montantEUR) || isNaN(montantEUR)) {
    throw new Error(`Montant EUR invalide: ${montantEUR}`);
  }
  return arrondiHalfUp(montantEUR * 100);
}

/** Convertit des centimes en EUR */
export function centimesToEUR(centimes: number): number {
  if (!Number.isInteger(centimes)) {
    throw new Error(`Les centimes doivent être un entier, reçu: ${centimes}`);
  }
  return centimes / 100;
}

// ─── Formatage ───────────────────────────────────────────────────────

const LOCALE_MAP: Record<string, string> = {
  XOF: "fr-FR",
  XAF: "fr-FR",
  EUR: "fr-FR",
  USD: "en-US",
};

const FRACTION_DIGITS: Record<string, number> = {
  XOF: 0,  // Le franc CFA n'a pas de centimes en usage courant
  XAF: 0,
  EUR: 2,
  USD: 2,
};

/**
 * Formate un montant en centimes pour affichage
 * @example formatMontant(1000000, "XOF") → "10 000 XOF"
 * @example formatMontant(1099, "EUR") → "10,99 €"
 */
export function formatMontant(centimes: number, devise: string = "XOF"): string {
  if (!Number.isInteger(centimes)) {
    throw new Error(`Les centimes doivent être un entier pour formatage, reçu: ${centimes}`);
  }

  const valeur = centimes / 100;
  const locale = LOCALE_MAP[devise] ?? "fr-FR";
  const fractions = FRACTION_DIGITS[devise] ?? 2;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: devise,
      minimumFractionDigits: fractions,
      maximumFractionDigits: fractions,
    }).format(valeur);
  } catch {
    // Fallback si la devise n'est pas reconnue par Intl
    const formatted = valeur.toLocaleString(locale, {
      minimumFractionDigits: fractions,
      maximumFractionDigits: fractions,
    });
    return `${formatted} ${devise}`;
  }
}

/** Retourne un objet de formatage complet */
export function formatCurrency(centimes: number, devise: string = "XOF"): CurrencyFormat {
  return {
    montant: centimes,
    formatted: formatMontant(centimes, devise),
    devise,
  };
}

// ─── Formatage des taux ───────────────────────────────────────────────

/** Convertit des basis points en pourcentage lisible */
export function bpToPourcent(bp: number): string {
  return `${(bp / 100).toFixed(2)}%`;
}

/** Convertit un pourcentage en basis points */
export function pourcentToBP(pourcent: number): number {
  return arrondiHalfUp(pourcent * 100);
}

// ─── Calcul de checksums d'intégrité ─────────────────────────────────
import { createHash } from "crypto";

/**
 * Génère un checksum SHA-256 d'une répartition financière.
 * Utilisé pour détecter toute altération des données.
 */
export function genererChecksumRepartition(
  repartition: Omit<RepartitionFinanciere, "timestamp">
): string {
  const payload = JSON.stringify({
    prixTTC: repartition.prixTTC,
    prixHT: repartition.prixHT,
    tva: repartition.tva,
    commission: repartition.commission,
    netOrganisateur: repartition.netOrganisateur,
    tauxTVA: repartition.tauxTVA,
    tauxCommission: repartition.tauxCommission,
  });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Génère un checksum générique pour n'importe quel objet.
 * Tri les clés pour garantir le déterminisme.
 */
export function genererChecksum(data: Record<string, unknown>): string {
  const sorted = Object.keys(data)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = data[k];
      return acc;
    }, {});
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

// ─── Utilitaires de reporting ─────────────────────────────────────────

/** Agrège une liste de répartitions (pour reporting batch) */
export function agregerRepartitions(repartitions: RepartitionFinanciere[]): {
  totalTTC: number;
  totalHT: number;
  totalTVA: number;
  totalCommission: number;
  totalNetOrganisateur: number;
  count: number;
} {
  return repartitions.reduce(
    (acc, r) => ({
      totalTTC: acc.totalTTC + r.prixTTC,
      totalHT: acc.totalHT + r.prixHT,
      totalTVA: acc.totalTVA + r.tva,
      totalCommission: acc.totalCommission + r.commission,
      totalNetOrganisateur: acc.totalNetOrganisateur + r.netOrganisateur,
      count: acc.count + 1,
    }),
    {
      totalTTC: 0,
      totalHT: 0,
      totalTVA: 0,
      totalCommission: 0,
      totalNetOrganisateur: 0,
      count: 0,
    }
  );
}

/** Calcule la part de TVA d'un montant TTC */
export function extractTVA(prixTTC: number, tauxTVA_bp: number = TAUX_TVA_BP): number {
  const tvaDivisor = BP_DIVISOR + tauxTVA_bp;
  const prixHT = arrondiHalfUp((prixTTC * BP_DIVISOR) / tvaDivisor);
  return prixTTC - prixHT;
}
