import { PrismaClient } from '../../src/generated/prisma/client.js';

const leisureCategoriesData = [
  { name: 'Hôtels', slug: 'hotels' },
  { name: 'Restaurants', slug: 'restaurants' },
  { name: 'Sport & Bien-être', slug: 'sports' },
  { name: 'Loisirs', slug: 'loisirs' },
  { name: 'Évasion', slug: 'envolee' },
  { name: 'Bar & Nuit', slug: 'bar-night' },
];

export async function seedLeisureCategories(prisma: PrismaClient) {
  for (const cat of leisureCategoriesData) {
    await prisma.leisureCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: cat,
    });
  }
  console.log(`✅ ${leisureCategoriesData.length} catégories de loisirs créées`);
}
