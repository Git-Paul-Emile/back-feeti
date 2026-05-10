import { PrismaClient } from '../../src/generated/prisma/client.js';

const blogCategories = [
  { name: 'Événements',  slug: 'events',    icon: 'calendar' },
  { name: 'Culture',     slug: 'culture',   icon: 'palette' },
  { name: 'Lifestyle',   slug: 'lifestyle', icon: 'trending-up' },
  { name: 'Technologie', slug: 'tech',      icon: 'cpu' },
];

export async function seedBlogCategories(prisma: PrismaClient) {
  for (const cat of blogCategories) {
    await prisma.blogCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon },
      create: cat,
    });
  }
  console.log(`✅ ${blogCategories.length} catégories de blog créées`);
}
