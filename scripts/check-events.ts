import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/client.js';

const prisma = new PrismaClient();

async function check() {
  const events = await prisma.event.groupBy({
    by: ['status'],
    _count: { id: true }
  });
  console.log("Event statuses:", events);
  process.exit(0);
}

check();
