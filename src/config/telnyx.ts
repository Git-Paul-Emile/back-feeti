/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  CONFIG TELNYX — messagerie SMS & WhatsApp
 *  Centralise la lecture des variables d'environnement Telnyx afin que le
 *  service (telnyx.service.ts) reste focalisé sur la logique d'envoi (SRP).
 *
 *  Où récupérer les valeurs (portail Telnyx — https://portal.telnyx.com) :
 *    - TELNYX_API_KEY            → « API Keys » (section Auth)
 *    - TELNYX_MESSAGING_PROFILE_ID → « Messaging » > votre profil
 *    - TELNYX_SMS_FROM           → « Numbers > My Numbers » (numéro SMS, E.164)
 *    - TELNYX_WHATSAPP_FROM      → numéro WhatsApp Business activé (E.164)
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface TelnyxConfig {
  /** Clé API Telnyx (Bearer). Si absente → mode simulation (aucun envoi réel). */
  apiKey?: string;
  /** Base de l'API Telnyx v2. */
  apiUrl: string;
  /** Numéro expéditeur SMS au format E.164 (ex. +24206XXXXXXX). */
  smsFrom?: string;
  /** ID du profil de messagerie (alternative à `smsFrom` pour choisir l'expéditeur). */
  messagingProfileId?: string;
  /** Numéro WhatsApp Business expéditeur au format E.164. */
  whatsappFrom?: string;
  /**
   * Indicatif pays par défaut (ex. « +242 ») utilisé pour normaliser les numéros
   * saisis au format local (sans indicatif). Optionnel.
   */
  defaultCountryCode?: string;
}

/** Lit la configuration Telnyx depuis l'environnement (une seule source de vérité). */
export function loadTelnyxConfig(): TelnyxConfig {
  return {
    apiKey: process.env.TELNYX_API_KEY?.trim() || undefined,
    apiUrl: (process.env.TELNYX_API_URL?.trim() || "https://api.telnyx.com/v2").replace(/\/+$/, ""),
    smsFrom: process.env.TELNYX_SMS_FROM?.trim() || undefined,
    messagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID?.trim() || undefined,
    whatsappFrom: process.env.TELNYX_WHATSAPP_FROM?.trim() || undefined,
    defaultCountryCode: process.env.TELNYX_DEFAULT_COUNTRY_CODE?.trim() || undefined,
  };
}

/**
 * Normalise un numéro au format E.164 exigé par Telnyx (« +indicatifnuméro »,
 * sans espaces ni ponctuation).
 * - Retire tout caractère non numérique (sauf le « + » de tête).
 * - Convertit un préfixe « 00 » en « + ».
 * - Si le numéro n'a pas d'indicatif et qu'un indicatif par défaut est fourni,
 *   l'ajoute (en retirant un éventuel 0 initial).
 */
export function toE164(raw: string, defaultCountryCode?: string): string {
  if (!raw) return raw;
  let n = raw.trim().replace(/[\s().-]/g, "");
  if (n.startsWith("00")) n = "+" + n.slice(2);
  if (n.startsWith("+")) return "+" + n.slice(1).replace(/\D/g, "");
  n = n.replace(/\D/g, "");
  if (defaultCountryCode) {
    const cc = defaultCountryCode.replace(/[^\d+]/g, "");
    const local = n.replace(/^0+/, "");
    return (cc.startsWith("+") ? cc : "+" + cc) + local;
  }
  return "+" + n;
}
