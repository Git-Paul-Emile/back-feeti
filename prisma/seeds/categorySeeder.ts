import { PrismaClient } from '../../src/generated/prisma/client.js';

const categoriesData = [
  { name: 'Musique',      slug: 'musique',      icon: 'music' },
  { name: 'Concert',      slug: 'concert',      icon: 'sound' },
  { name: 'Festival',     slug: 'festival',     icon: 'music' },
  { name: 'Jazz',         slug: 'jazz',         icon: 'sound' },
  { name: 'Théâtre',      slug: 'theatre',      icon: 'video' },
  { name: 'Art & Culture',slug: 'art-culture',  icon: 'brush' },
  { name: 'Danse',        slug: 'danse',        icon: 'tree' },
  { name: 'Cinéma',       slug: 'cinema',       icon: 'video' },
  { name: 'Sport',        slug: 'sport',        icon: 'weight' },
  { name: 'Compétition',  slug: 'competition',  icon: 'speedometer' },
  { name: 'Conférence',   slug: 'conference',   icon: 'microscope' },
  { name: 'Formation',    slug: 'formation',    icon: 'book' },
  { name: 'Forum',        slug: 'forum',        icon: 'briefcase' },
  { name: 'Tech',         slug: 'tech',         icon: 'cpu' },
  { name: 'Gastronomie',  slug: 'gastronomie',  icon: 'reserve' },
  { name: 'Humour',       slug: 'humour',       icon: 'global' },
  { name: 'Soirée',       slug: 'soiree',       icon: 'crown' },
  { name: 'Culte',        slug: 'culte',        icon: 'hospital' },
  { name: 'Autre',        slug: 'autre',        icon: 'pen-tool' },
];

export async function seedCategories(prisma: PrismaClient) {
  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon },
      create: cat,
    });
  }
  console.log(`✅ ${categoriesData.length} catégories créées`);
}
