import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedCategories } from './seeds/categorySeeder.js';
import { seedUsers } from './seeds/userSeeder.js';
import { seedEvents } from './seeds/eventSeeder.js';
import { seedCountries } from './seeds/countrySeeder.js';
import { seedDeals } from './seeds/dealSeeder.js';
import { seedDealCategories } from './seeds/dealCategorySeeder.js';
import { seedLeisureCategories } from './seeds/leisureCategorySeeder.js';
import { seedLeisureItems } from './seeds/leisureSeeder.js';
import { seedBlogCategories } from './seeds/blogCategorySeeder.js';
import { seedBlogPosts } from './seeds/blogPostSeeder.js';
import { seedDeliveryZones } from './seeds/deliveryZoneSeeder.js';
import { seedDeliveryCities } from './seeds/deliveryCitySeeder.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Démarrage du seeding...');

  await seedCountries(prisma);
  await seedCategories(prisma);
  const { organizer, admin } = await seedUsers(prisma);
  await seedEvents(prisma, organizer.id);
  await seedDealCategories(prisma);
  await seedDeals(prisma, admin.id);
  await seedLeisureCategories(prisma);
  await seedLeisureItems(prisma, admin.id);
  await seedBlogCategories(prisma);
  await seedBlogPosts(prisma, admin.id);
  const zoneIdMap = await seedDeliveryZones(prisma);
  await seedDeliveryCities(prisma, zoneIdMap);

  console.log('');
  console.log('🎉 Seeding terminé !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur seeding:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
