import { Worker, type Job } from "bullmq";
import { redisForWorker } from "../config/redis.js";
import { feetiPlaySyncService } from "../services/feetiPlaySync.service.js";
import type { FeetiPlaySyncJobData } from "./feetiPlaySync.queue.js";
import { logger } from "../utils/logger.js";

async function processFeetiPlaySyncJob(job: Job<FeetiPlaySyncJobData>): Promise<void> {
  const d = job.data;
  logger.info(`[feetiplay-sync] processing job ${job.id} (${d.type})`);

  switch (d.type) {
    case "upsert":
      await feetiPlaySyncService.upsertLiveEvent(d.payload);
      break;
    case "delete":
      await feetiPlaySyncService.deleteLiveEvent(d.id);
      break;
  }
}

export function startFeetiPlaySyncWorker(): Worker<FeetiPlaySyncJobData> {
  const worker = new Worker<FeetiPlaySyncJobData>("feetiplay-sync", processFeetiPlaySyncJob, {
    connection: redisForWorker,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    logger.info(`[feetiplay-sync] ✓ job ${job.id} (${job.data.type})`);
  });

  worker.on("failed", (job, err) => {
    const attempts = job?.attemptsMade ?? "?";
    console.error(`[feetiplay-sync] ✗ job ${job?.id} (${job?.data?.type}) tentative ${attempts} — ${err.message}`);
  });

  worker.on("error", (err) => {
    console.error(`[feetiplay-sync] worker error — ${err.message}`, err);
  });

  logger.info("[feetiplay-sync] worker démarré (concurrency: 5)");
  return worker;
}
