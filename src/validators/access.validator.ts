import { z } from "zod";

export const createZoneSchema = z.object({
  code: z.string().refine((v) => ["Z1","Z2","Z3","Z4","Z5","Z6","Z7","Z8","Z9","Z10"].includes(v), { message: "Code zone invalide (Z1–Z10)" }),
  name: z.string().min(2).max(100),
  description: z.string().max(300).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur hex invalide").optional(),
  maxCapacity: z.number().int().positive().optional(),
});

export const updateZoneSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(300).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isActive: z.boolean().optional(),
  maxCapacity: z.number().int().positive().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Au moins un champ requis" });

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(300).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(300).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Au moins un champ requis" });

export const setAccessRightsSchema = z.object({
  rights: z.array(z.object({
    categoryId: z.string().min(1),
    zoneId: z.string().min(1),
    accessLevel: z.string().refine((v) => ["OUI","NON","COND"].includes(v), { message: "Niveau invalide (OUI/NON/COND)" }),
  })).min(1, "Au moins un droit requis"),
});

export const generateBadgeSchema = z.object({
  categoryId: z.string().min(1),
  holderName: z.string().min(2).max(100),
  holderEmail: z.string().email(),
  holderPhone: z.string().min(6).max(30).optional(),
  holderPhoto: z.string().url().max(1000).optional(),
  ticketId: z.string().optional(),
});

export const scanSchema = z.object({
  qrCode: z.string().min(1),
  zoneId: z.string().min(1),
  agentCode: z.string().min(3).max(50).optional(),
});

export const syncOfflineSchema = z.object({
  scans: z.array(z.object({
    qrCode: z.string().min(1),
    zoneId: z.string().min(1),
    scannedAt: z.string().datetime(),
  })).min(1),
});

export const reportSuspectSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const verifyAgentCodeSchema = z.object({
  code: z.string().min(3).max(50),
});

export const sendBadgeSmsSchema = z.object({
  phone: z.string().min(6).max(30).optional(),
});

export const duplicateConfigSchema = z.object({
  sourceEventId: z.string().min(1),
});

export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type SetAccessRightsInput = z.infer<typeof setAccessRightsSchema>;
export type GenerateBadgeInput = z.infer<typeof generateBadgeSchema>;
export type ScanInput = z.infer<typeof scanSchema>;
export type SyncOfflineInput = z.infer<typeof syncOfflineSchema>;
