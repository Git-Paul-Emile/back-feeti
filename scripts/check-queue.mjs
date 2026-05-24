import { config } from 'dotenv';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

config();

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
const q = new Queue('emails', { connection: redis });

const [w, a, c, f, d] = await Promise.all([
  q.getWaitingCount(), q.getActiveCount(), q.getCompletedCount(), q.getFailedCount(), q.getDelayedCount()
]);
console.log(`waiting:${w} | active:${a} | completed:${c} | failed:${f} | delayed:${d}`);

const failedJobs = await q.getFailed(0, 10);
if (failedJobs.length > 0) {
  console.log('\n--- FAILED JOBS ---');
  failedJobs.forEach(j => {
    console.log(`[${j.data.type}] → ${j.data.to} | attempts: ${j.attemptsMade} | reason: ${j.failedReason}`);
  });
}

const completedJobs = await q.getCompleted(0, 5);
if (completedJobs.length > 0) {
  console.log('\n--- LAST COMPLETED ---');
  completedJobs.forEach(j => console.log(`[${j.data.type}] → ${j.data.to}`));
}

await redis.quit();
process.exit(0);
