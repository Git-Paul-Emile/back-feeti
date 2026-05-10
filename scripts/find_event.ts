import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
prisma.event.findUnique({ where: { id: 'feeti2_live_c71712f6-fad1-4d49-868f-63db19d1d165' } })
  .then(e => console.log('Found event:', e ? e.id : 'null'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
