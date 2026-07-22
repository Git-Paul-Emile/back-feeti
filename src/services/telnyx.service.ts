/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SERVICE MESSAGERIE TELNYX — SMS & WhatsApp
 *  Architecture « pluggable » (même esprit que email.service.ts) :
 *    - IMessagingProvider : contrat commun (DIP / OCP).
 *    - TelnyxProvider     : implémentation réelle via l'API REST Telnyx v2.
 *    - SimulationProvider : repli (logs) quand aucune clé API n'est configurée,
 *                           pour ne pas bloquer le développement/les tests.
 *
 *  API Telnyx utilisée (REST, pas de dépendance SDK — `fetch` natif Node 18+) :
 *    - SMS      : POST {apiUrl}/messages           { from|messaging_profile_id, to, text }
 *    - WhatsApp : POST {apiUrl}/messages/whatsapp  { from, to, text }
 *    Auth : header « Authorization: Bearer <TELNYX_API_KEY> ».
 *    Réf. : https://developers.telnyx.com/docs/messaging/messages/send-message
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { logger } from "../utils/logger.js";
import { loadTelnyxConfig, toE164, type TelnyxConfig } from "../config/telnyx.js";

export type MessageChannel = "sms" | "whatsapp";

export interface MessagingResult {
  provider: "telnyx" | "simulation";
  channel: MessageChannel;
  delivered: boolean;
  /** Identifiant Telnyx du message (permet le suivi via webhook). */
  id?: string;
  to: string;
}

export interface SendOptions {
  /** Si false, l'échec est loggé mais ne lève pas d'exception (best-effort). */
  throwOnError?: boolean;
}

export interface IMessagingProvider {
  sendSms(to: string, text: string, opts?: SendOptions): Promise<MessagingResult>;
  sendWhatsApp(to: string, text: string, opts?: SendOptions): Promise<MessagingResult>;
}

// ─── Erreur métier dédiée (facilite le catch côté appelant) ──────────────────

export class TelnyxError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "TelnyxError";
  }
}

// ─── Provider réel (API REST Telnyx) ─────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

class TelnyxProvider implements IMessagingProvider {
  constructor(private readonly cfg: TelnyxConfig) {}

  async sendSms(to: string, text: string, opts: SendOptions = {}): Promise<MessagingResult> {
    const recipient = toE164(to, this.cfg.defaultCountryCode);
    const body: Record<string, unknown> = { to: recipient, text };
    // On privilégie le profil de messagerie si fourni, sinon le numéro expéditeur.
    if (this.cfg.messagingProfileId) body.messaging_profile_id = this.cfg.messagingProfileId;
    else if (this.cfg.smsFrom) body.from = this.cfg.smsFrom;
    else throw new TelnyxError("Aucun expéditeur SMS configuré (TELNYX_SMS_FROM ou TELNYX_MESSAGING_PROFILE_ID).");

    return this.dispatch("/messages", body, "sms", recipient, opts);
  }

  async sendWhatsApp(to: string, text: string, opts: SendOptions = {}): Promise<MessagingResult> {
    const recipient = toE164(to, this.cfg.defaultCountryCode);
    if (!this.cfg.whatsappFrom) {
      throw new TelnyxError("Aucun numéro WhatsApp expéditeur configuré (TELNYX_WHATSAPP_FROM).");
    }
    const body = { from: this.cfg.whatsappFrom, to: recipient, text };
    return this.dispatch("/messages/whatsapp", body, "whatsapp", recipient, opts);
  }

  /** Envoi HTTP mutualisé, avec retries exponentiels sur 429/5xx (recommandé par Telnyx). */
  private async dispatch(
    path: string,
    body: Record<string, unknown>,
    channel: MessageChannel,
    recipient: string,
    opts: SendOptions,
  ): Promise<MessagingResult> {
    const url = `${this.cfg.apiUrl}${path}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.cfg.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const json = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
          logger.info(`[telnyx:${channel}] envoyé à ${recipient} (id=${json.data?.id ?? "?"})`);
          return { provider: "telnyx", channel, delivered: true, id: json.data?.id, to: recipient };
        }

        // Erreur : on tente d'extraire le détail structuré Telnyx.
        const errText = await res.text().catch(() => "");
        const parsed = safeParseTelnyxError(errText);
        const shouldRetry = RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES;

        if (shouldRetry) {
          const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt;
          const waitMs = retryAfter * 1000 * (0.5 + Math.random()); // jitter
          logger.warn(`[telnyx:${channel}] ${res.status} — nouvelle tentative dans ${Math.round(waitMs)}ms`);
          await sleep(waitMs);
          continue;
        }

        throw new TelnyxError(
          `[telnyx:${channel}] échec (${res.status}) vers ${recipient} : ${parsed.detail}`,
          res.status,
          parsed.code,
        );
      } catch (err) {
        lastError = err;
        // Erreur réseau (fetch a throw) → on retente si possible.
        if (!(err instanceof TelnyxError) && attempt < MAX_RETRIES) {
          const waitMs = 2 ** attempt * 1000 * (0.5 + Math.random());
          logger.warn(`[telnyx:${channel}] erreur réseau — nouvelle tentative dans ${Math.round(waitMs)}ms`);
          await sleep(waitMs);
          continue;
        }
        break;
      }
    }

    // Échec définitif.
    logger.error(`[telnyx:${channel}] échec définitif vers ${recipient}`, lastError);
    if (opts.throwOnError === false) {
      return { provider: "telnyx", channel, delivered: false, to: recipient };
    }
    if (lastError instanceof TelnyxError) throw lastError;
    throw new TelnyxError(`[telnyx:${channel}] échec réseau vers ${recipient} : ${(lastError as Error)?.message}`);
  }
}

// ─── Provider de simulation (pas de clé API) ─────────────────────────────────

class SimulationProvider implements IMessagingProvider {
  private simulate(channel: MessageChannel, to: string, text: string): MessagingResult {
    logger.info(`[messaging:simulation:${channel}] ${to}: ${text}`);
    return { provider: "simulation", channel, delivered: true, to };
  }
  async sendSms(to: string, text: string): Promise<MessagingResult> {
    return this.simulate("sms", to, text);
  }
  async sendWhatsApp(to: string, text: string): Promise<MessagingResult> {
    return this.simulate("whatsapp", to, text);
  }
}

// ─── Sélection du provider + façade exportée ─────────────────────────────────

function buildProvider(): IMessagingProvider {
  const cfg = loadTelnyxConfig();
  if (!cfg.apiKey) {
    logger.warn("[messaging] TELNYX_API_KEY absente → mode simulation (aucun SMS/WhatsApp réel envoyé).");
    return new SimulationProvider();
  }
  return new TelnyxProvider(cfg);
}

/**
 * Service de messagerie exposé au reste de l'application.
 * Le provider est résolu paresseusement pour tenir compte des variables
 * d'environnement chargées au démarrage.
 */
class MessagingService implements IMessagingProvider {
  private _provider: IMessagingProvider | null = null;
  private get provider(): IMessagingProvider {
    if (!this._provider) this._provider = buildProvider();
    return this._provider;
  }
  sendSms(to: string, text: string, opts?: SendOptions) {
    return this.provider.sendSms(to, text, opts);
  }
  sendWhatsApp(to: string, text: string, opts?: SendOptions) {
    return this.provider.sendWhatsApp(to, text, opts);
  }
}

export const messagingService = new MessagingService();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function safeParseTelnyxError(raw: string): { detail: string; code?: string } {
  try {
    const json = JSON.parse(raw) as { errors?: Array<{ code?: string; title?: string; detail?: string }> };
    const first = json.errors?.[0];
    if (first) return { detail: first.detail || first.title || raw, code: first.code };
  } catch {
    /* corps non JSON */
  }
  return { detail: raw || "erreur inconnue" };
}
