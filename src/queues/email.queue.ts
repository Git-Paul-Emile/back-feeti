import { Queue } from "bullmq";
import { redisForQueue } from "../config/redis.js";
import type { WeeklyDigestContent } from "../services/weeklyDigest.service.js";

// ─── Types des jobs ───────────────────────────────────────────────────────────

export interface TicketConfirmationData {
  holderName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  orderId: string;
  tickets: { id: string; category: string; price: number; currency: string; qrDataUrl?: string }[];
  totalAmount: number;
  currency: string;
}

export interface EventReminderData {
  holderName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  ticketCount: number;
}

export type EmailJobData =
  | { type: "welcome-user";        to: string; userName: string }
  | { type: "welcome-organizer";   to: string; organizerName: string; contractHtml?: string; pandadocSigningUrl?: string }
  | { type: "ticket-confirmation"; to: string; data: TicketConfirmationData }
  | { type: "password-changed";    to: string; userName: string }
  | { type: "event-reminder";      to: string; data: EventReminderData }
  | { type: "generic";             to: string; subject: string; html: string }
  // Newsletter "Les Fééties de la semaine" — un envoi unitaire à un destinataire.
  | { type: "weekly-digest";       to: string; content: WeeklyDigestContent; unsubscribeUrl: string }
  // Déclenche la campagne complète : résout l'audience + le contenu, puis
  // ré-enfile un job "weekly-digest" par destinataire.
  | { type: "weekly-digest-campaign" };

// ─── Queue ────────────────────────────────────────────────────────────────────

export const emailQueue = new Queue<EmailJobData>("emails", {
  connection: redisForQueue,
  defaultJobOptions: {
    attempts: 4,
    backoff: { type: "exponential", delay: 3000 }, // 3s → 6s → 12s → 24s
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

// ─── Helper d'ajout ───────────────────────────────────────────────────────────

export async function addEmailJob(job: EmailJobData): Promise<void> {
  await emailQueue.add(job.type, job);
}

// ─── Campagne récurrente : "Les Fééties de la semaine" ─────────────────────
//
// Job récurrent (BullMQ repeatable) qui déclenche chaque lundi 8h
// (Africa/Brazzaville) la campagne complète. BullMQ déduplique les jobs
// répétables par leur "repeat key" (nom + options) : rappeler cette fonction
// à chaque démarrage du serveur est donc sans risque de doublon.
export async function scheduleWeeklyDigestCampaign(): Promise<void> {
  await emailQueue.add(
    "weekly-digest-campaign",
    { type: "weekly-digest-campaign" },
    {
      repeat: { pattern: "0 8 * * 1", tz: "Africa/Brazzaville" },
      jobId: "weekly-digest-campaign",
    }
  );
}
