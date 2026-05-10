import { PrismaClient } from '../../src/generated/prisma/client.js';
import bcrypt from 'bcrypt';

export async function seedUsers(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash('seed1234', 10);

  const organizer = await prisma.user.upsert({
    where: { email: 'seed-organizer@feeti.cg' },
    update: {},
    create: {
      name: 'Feeti Events',
      email: 'seed-organizer@feeti.cg',
      passwordHash,
      role: 'organizer',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@feeti.cg' },
    update: {},
    create: {
      name: 'Admin Feeti',
      email: 'admin@feeti.cg',
      passwordHash,
      role: 'admin',
    },
  });

  // Acheteur de test avec centres d'intérêts
  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@feeti.cg' },
    update: {},
    create: {
      name: 'Jean Féeteur',
      email: 'buyer@feeti.cg',
      passwordHash,
      role: 'user',
      interests: JSON.stringify(['musique', 'concert', 'festival', 'soiree']),
    },
  });

  console.log('✅ Utilisateurs créés');
  console.log('📧 Comptes créés :');
  console.log(`   Organisateur : seed-organizer@feeti.cg / seed1234`);
  console.log(`   Admin        : admin@feeti.cg / seed1234`);
  console.log(`   Acheteur     : buyer@feeti.cg / seed1234 (intérêts: musique, concert, festival, soirée)`);

  return { organizer, admin, buyer };
}
