import { config } from 'dotenv';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

config();

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
const q = new Queue('emails-test', { connection: redis });

try {
  const job = await q.add('welcome-user', { type: 'welcome-user', to: 'test@test.com', userName: 'Test' });
  console.log('SUCCESS - job id:', job.id);
  await q.drain();
} catch (err) {
  console.error('FAILED to add job:', err.message);
}

await redis.quit();
process.exit(0);
