/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SERVICE SMS — façade de compatibilité au-dessus de Telnyx.
 *  Conserve l'API historique `smsService.send(to, message)` utilisée par
 *  access.service (badges) et les tests, tout en déléguant l'envoi réel au
 *  service de messagerie Telnyx (SMS). WhatsApp est exposé via `sendWhatsApp`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { messagingService } from "./telnyx.service.js";

export interface SmsResult {
  provider: "telnyx" | "simulation";
  delivered: boolean;
  /** Identifiant Telnyx (suivi via webhook), si disponible. */
  id?: string;
}

class SmsService {
  /** Envoie un SMS. N'interrompt pas l'appelant en cas d'échec (best-effort). */
  async send(to: string, message: string): Promise<SmsResult> {
    const r = await messagingService.sendSms(to, message, { throwOnError: false });
    return { provider: r.provider, delivered: r.delivered, id: r.id };
  }

  /** Envoie un message WhatsApp. */
  async sendWhatsApp(to: string, message: string): Promise<SmsResult> {
    const r = await messagingService.sendWhatsApp(to, message, { throwOnError: false });
    return { provider: r.provider, delivered: r.delivered, id: r.id };
  }
}

export const smsService = new SmsService();
