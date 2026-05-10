import { PrismaClient } from '../../src/generated/prisma/client.js';

const dealCategoriesData = [
  { name: 'Hebdomadaire', slug: 'weekly', icon: null },
  { name: 'Général', slug: 'general', icon: null },
  { name: 'Feeti Na Feeti', slug: 'feeti-na-feeti', icon: null },
  { name: 'Restaurants', slug: 'restaurants', icon: null },
  { name: 'Hôtels', slug: 'hotels', icon: null },
  { name: 'Activités', slug: 'activities', icon: null },
  { name: 'Shopping', slug: 'shopping', icon: null },
];

export async function seedDealCategories(prisma: PrismaClient) {
  for (const cat of dealCategoriesData) {
    await prisma.dealCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon },
      create: cat,
    });
  }
  console.log(`✅ ${dealCategoriesData.length} catégories de bons plans créées`);
}
