import { PrismaClient } from '../../src/generated/prisma/client.js';
import { seedBlogPostsEvents } from './blogPosts/blogPostEventsSeeder.js';
import { seedBlogPostsCulture } from './blogPosts/blogPostCultureSeeder.js';
import { seedBlogPostsLifestyle } from './blogPosts/blogPostLifestyleSeeder.js';
import { seedBlogPostsTech } from './blogPosts/blogPostTechSeeder.js';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export async function seedBlogPosts(prisma: PrismaClient, authorId: string) {
  console.log('📝 Seeding articles de blog...');
  await seedBlogPostsEvents(prisma, authorId, slugify);
  await seedBlogPostsCulture(prisma, authorId, slugify);
  await seedBlogPostsLifestyle(prisma, authorId, slugify);
  await seedBlogPostsTech(prisma, authorId, slugify);
  console.log('✅ Articles de blog créés (16 au total)');
}
