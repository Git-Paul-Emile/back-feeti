import { config } from 'dotenv';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

config();

const redis1 = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
const redis2 = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });

const q = new Queue('emails-worker-test', { connection: redis1 });

let processed = false;

const worker = new Worker('emails-worker-test', async (job) => {
  console.log('Worker processed job:', job.id, job.data.type);
  processed = true;
}, { connection: redis2 });

worker.on('error', (err) => console.error('Worker ERROR:', err.message));
worker.on('failed', (job, err) => console.error('Job FAILED:', err.message));

await q.add('test', { type: 'test', to: 'x@x.com' });
console.log('Job added, waiting 5s for worker to process...');

await new Promise(r => setTimeout(r, 5000));

if (!processed) {
  console.error('PROBLEM: Worker did NOT process the job after 5 seconds!');
} else {
  console.log('OK: Worker processes jobs normally.');
}

await worker.close();
await redis1.quit();
await redis2.quit();
process.exit(processed ? 0 : 1);
