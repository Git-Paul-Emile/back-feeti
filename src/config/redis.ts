import { Redis } from "ioredis";

function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  return new Redis(url, {
    maxRetriesPerRequest: null, // requis par BullMQ
    enableReadyCheck: false,
  });
}

// Deux connexions séparées (Queue + Worker) comme recommandé par BullMQ
export const redisForQueue = createRedisConnection();
export const redisForWorker = createRedisConnection();
