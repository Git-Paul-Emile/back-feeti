import { z } from "zod";

export const walletAdjustmentSchema = z.object({
  montantCentimes: z.number().int().positive("Le montant doit être un entier positif (en centimes)"),
  type: z.enum(["credit", "debit"]),
  motif: z.string().min(1, "Le motif de l'ajustement est obligatoire"),
});

export type WalletAdjustmentInput = z.infer<typeof walletAdjustmentSchema>;
