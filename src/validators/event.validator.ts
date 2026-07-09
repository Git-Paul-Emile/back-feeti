import { z } from "zod";

const eventBaseFields = {
  title: z.string().min(1, "Titre requis"),
  description: z.string().min(1, "Description requise"),
  date: z.string().min(1, "Date requise"),
  time: z.string().min(1, "Heure requise"),
  location: z.string().min(1, "Lieu requis"),
  image: z.string().optional(),
  price: z.number().nonnegative().optional(),
  vipPrice: z.number().nonnegative().optional(),
  ticketTypes: z.string().optional(),
  currency: z.string().optional(),
  category: z.string().min(1, "Catégorie requise"),
  eventType: z.enum(["PRESENTIEL", "STREAMING_LIVE", "MIXTE"]).optional(),
  maxAttendees: z.number().int().positive("La capacité doit être un entier positif"),
  duration: z.string().optional(),
  isLive: z.boolean().optional(),
  streamUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  countryCode: z.string().optional(),
  featuredHomepage: z.boolean().optional(),
  isPrivateForBadges: z.boolean().optional(),
};

export const createEventSchema = z.object(eventBaseFields);
export const updateEventSchema = z.object(eventBaseFields).partial();

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
