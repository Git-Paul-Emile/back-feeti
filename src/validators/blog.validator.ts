import { z } from "zod";

export const createBlogCategorySchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(50),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Le slug ne doit contenir que des lettres minuscules, chiffres et tirets"),
  icon: z.string().optional(),
});

export const updateBlogCategorySchema = createBlogCategorySchema.partial();

export const createBlogPostSchema = z.object({
  title: z.string().min(5, "Le titre doit contenir au moins 5 caractères").max(200),
  excerpt: z.string().min(10, "Le résumé doit contenir au moins 10 caractères").max(500),
  content: z.string().min(20, "Le contenu doit contenir au moins 20 caractères"),
  categorySlug: z.string().min(1, "La catégorie est requise"),
  tags: z.array(z.string()).optional().default([]),
  featuredImage: z.string().url("L'URL de l'image est invalide").optional().or(z.literal("")),
  status: z.enum(["draft", "published"]).default("draft"),
  isFeatured: z.boolean().optional().default(false),
  readTime: z.number().int().min(1).optional(),
});

export const updateBlogPostSchema = createBlogPostSchema.partial();

export type CreateBlogCategoryInput = z.infer<typeof createBlogCategorySchema>;
export type UpdateBlogCategoryInput = z.infer<typeof updateBlogCategorySchema>;
export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;
