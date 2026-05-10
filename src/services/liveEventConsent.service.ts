import { prisma } from "../config/database.js";
import { AppError } from "../utils/AppError.js";
import { StatusCodes } from "http-status-codes";

export type LiveEventType = "STREAMING_LIVE" | "MIXTE";

export const liveEventConsentService = {
  /**
   * Envoie les formulaires PDF requis pour un événement en live ou mixte.
   * Les PDFs ne sont pas encore conçus — ce service retourne un message de succès/échec.
   */
  async requestLiveForms(data: {
    organizerEmail: string;
    eventName: string;
    eventType: LiveEventType;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // TODO: générer et envoyer les PDF réels par email
      // Pour l'instant, on enregistre la demande et on simule l'envoi
      await prisma.liveEventConsentRequest.create({
        data: {
          organizerEmail: data.organizerEmail,
          eventName: data.eventName,
          eventType: data.eventType,
          consentGiven: false,
          pdfRequestedAt: new Date(),
        },
      });

      return {
        success: true,
        message: `Les formulaires PDF vous seront envoyés à l'adresse ${data.organizerEmail} sous 24h. Veuillez les compléter et les retourner avant la publication de votre événement.`,
      };
    } catch {
      return {
        success: false,
        message: "Erreur lors de l'envoi des formulaires PDF. Veuillez réessayer ou contacter le support.",
      };
    }
  },

  /**
   * Enregistre le consentement de l'organisateur pour la diffusion en live/mixte.
   */
  async recordConsent(data: {
    organizerEmail: string;
    eventName: string;
    eventType: LiveEventType;
    consentGiven: boolean;
  }): Promise<{ success: boolean; message: string }> {
    if (!data.consentGiven) {
      throw new AppError(
        "Le consentement est obligatoire pour les événements en Streaming Live ou Mixte.",
        StatusCodes.BAD_REQUEST
      );
    }

    try {
      // Mettre à jour la dernière demande existante ou en créer une nouvelle
      const existing = await prisma.liveEventConsentRequest.findFirst({
        where: {
          organizerEmail: data.organizerEmail,
          eventName: data.eventName,
          eventType: data.eventType,
          consentGiven: false,
        },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        await prisma.liveEventConsentRequest.update({
          where: { id: existing.id },
          data: { consentGiven: true },
        });
      } else {
        await prisma.liveEventConsentRequest.create({
          data: {
            organizerEmail: data.organizerEmail,
            eventName: data.eventName,
            eventType: data.eventType,
            consentGiven: true,
          },
        });
      }

      return {
        success: true,
        message: "Consentement enregistré avec succès.",
      };
    } catch {
      return {
        success: false,
        message: "Erreur lors de l'enregistrement du consentement. Veuillez réessayer.",
      };
    }
  },
};
