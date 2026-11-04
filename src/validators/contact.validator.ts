import { z } from "zod";

export const CONTACT_REASONS = ["ticketing", "partnership", "advertising", "press", "support", "other"] as const;

export const contactRequestSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(80),
  lastName: z.string().trim().min(1, "Nom requis").max(80),
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
  phone: z.string().trim().min(6, "Numéro de téléphone invalide").max(30),
  company: z.string().trim().min(1, "Société requise").max(120),
  vertical: z.string().trim().min(1, "Secteur requis").max(80),
  country: z.string().trim().min(1, "Pays requis").max(80),
  ticketsPerYear: z.string().trim().max(40).optional().default(""),
  averagePrice: z.string().trim().max(40).optional().default(""),
  reason: z.enum(CONTACT_REASONS, { message: "Motif invalide" }),
  message: z.string().trim().max(3000).optional().default(""),
  // Champ piège anti-robot : doit rester vide
  website: z.string().max(0).optional(),
});

export type ContactRequest = z.infer<typeof contactRequestSchema>;
