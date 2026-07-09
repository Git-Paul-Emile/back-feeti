import { Queue } from "bullmq";
import { redisForQueue } from "../config/redis.js";
import { feetiPlaySyncService, type SyncPayload } from "../services/feetiPlaySync.service.js";
import { logger } from "../utils/logger.js";

export type FeetiPlaySyncJobData =
  | { type: "upsert"; payload: SyncPayload }
  | { type: "delete"; id: string };

// ─── Queue ────────────────────────────────────────────────────────────────────
// Synchronisation feeti2 → FeetiPlay des événements STREAMING_LIVE/MIXTE.
// Ces appels HTTP vers FeetiPlay peuvent échouer (réseau, FeetiPlay indisponible) ;
// sans retry, l'échec était jusqu'ici silencieusement perdu (event.service.ts
// faisait juste un .catch(err => logger.error(...))), désynchronisant durablement
// les deux applications.

export const feetiPlaySyncQueue = new Queue<FeetiPlaySyncJobData>("feetiplay-sync", {
  connection: redisForQueue,
  defaultJobOptions: {
    attempts: 6,
    backoff: { type: "exponential", delay: 5000 }, // 5s → 10s → 20s → 40s → 80s → 160s
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export async function addFeetiPlayUpsertJob(payload: SyncPayload): Promise<void> {
  await feetiPlaySyncQueue.add("upsert", { type: "upsert", payload });
}

export async function addFeetiPlayDeleteJob(id: string): Promise<void> {
  await feetiPlaySyncQueue.add("delete", { type: "delete", id });
}

// ─── Helpers avec repli direct ────────────────────────────────────────────────
// Si la queue Redis est indisponible, on retente immédiatement l'appel direct
// (même filet de sécurité que pour la queue email, cf. payment.controller.ts).
// En dernier recours seulement, l'échec est logué sans bloquer l'appelant.

export function syncUpsertWithFallback(payload: SyncPayload, context: string): void {
  addFeetiPlayUpsertJob(payload).catch((queueErr) => {
    logger.warn(`[feetiplay-sync] Queue indisponible pour ${context}, tentative directe:`, (queueErr as Error).message);
    feetiPlaySyncService.upsertLiveEvent(payload).catch((err) => {
      logger.error(`[feetiplay-sync] Échec définitif upsert (${context}):`, err);
    });
  });
}

export function syncDeleteWithFallback(id: string, context: string): void {
  addFeetiPlayDeleteJob(id).catch((queueErr) => {
    logger.warn(`[feetiplay-sync] Queue indisponible pour ${context}, tentative directe:`, (queueErr as Error).message);
    feetiPlaySyncService.deleteLiveEvent(id).catch((err) => {
      logger.error(`[feetiplay-sync] Échec définitif delete (${context}):`, err);
    });
  });
}
