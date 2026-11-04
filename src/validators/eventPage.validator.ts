import { z } from "zod";

export const updateEventPageSchema = z
  .object({
    slug: z.string().trim().min(1).max(60).optional(),
    status: z.enum(["draft", "published", "paused"]).optional(),
    showOnMainSite: z.boolean().optional(),
    ctaLabel: z.string().trim().max(40).nullable().optional(),
    seoTitle: z.string().trim().max(60).nullable().optional(),
    seoDescription: z.string().trim().max(155).nullable().optional(),
  })
  .strict();
