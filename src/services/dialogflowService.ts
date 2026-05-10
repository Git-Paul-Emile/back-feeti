import { SessionsClient } from "@google-cloud/dialogflow";

type ChatbotResult = { reply: string; intent: string | null; confidence: number };

let _client: SessionsClient | null = null;

const FALLBACK_REPLY =
  "Je peux vous aider sur les billets, les paiements, les remboursements, l'acces aux evenements et l'organisation. Si votre demande est urgente, contactez support@feeti.cg.";

function getFallbackIntent(message: string): ChatbotResult {
  const normalized = message.toLowerCase();

  if (normalized.includes("billet") || normalized.includes("ticket")) {
    return {
      reply: "Pour vos billets, consultez votre espace client apres achat. Vous y trouverez le QR code et les details de l'evenement.",
      intent: "fallback.ticket",
      confidence: 0,
    };
  }

  if (normalized.includes("paiement") || normalized.includes("payer") || normalized.includes("rembours")) {
    return {
      reply: "Pour un paiement ou un remboursement, verifiez le statut de votre transaction dans votre compte. Si le probleme persiste, ecrivez a support@feeti.cg avec votre reference.",
      intent: "fallback.payment",
      confidence: 0,
    };
  }

  if (normalized.includes("organis") || normalized.includes("evenement") || normalized.includes("publier")) {
    return {
      reply: "Pour organiser ou publier un evenement, connectez-vous a votre espace organisateur, completez les informations obligatoires puis soumettez l'evenement.",
      intent: "fallback.organizer",
      confidence: 0,
    };
  }

  return {
    reply: FALLBACK_REPLY,
    intent: "fallback.default",
    confidence: 0,
  };
}

function getDialogflowConfig():
  | { projectId: string; clientEmail: string; privateKey: string }
  | null {
  const projectId = process.env.DIALOGFLOW_PROJECT_ID?.trim();
  const clientEmail = process.env.DIALOGFLOW_CLIENT_EMAIL?.trim();
  const privateKey = process.env.DIALOGFLOW_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return { projectId, clientEmail, privateKey };
}

function getClient(config: { clientEmail: string; privateKey: string }): SessionsClient {
  if (!_client) {
    _client = new SessionsClient({
      credentials: {
        client_email: config.clientEmail,
        private_key: config.privateKey,
      },
    });
  }
  return _client;
}

export async function detectIntent(message: string, sessionId: string): Promise<ChatbotResult> {
  const config = getDialogflowConfig();
  if (!config) {
    console.warn("[chatbot] Dialogflow non configure, utilisation du fallback local");
    return getFallbackIntent(message);
  }

  try {
    const client = getClient(config);
    const sessionPath = client.projectAgentSessionPath(config.projectId, sessionId);

    const [response] = await client.detectIntent({
      session: sessionPath,
      queryInput: {
        text: { text: message, languageCode: "fr" },
      },
    });

    const result = response.queryResult;

    return {
      reply:
        result?.fulfillmentText?.trim() ||
        "Je n'ai pas trouve de reponse. Consultez notre FAQ ou ecrivez a support@feeti.cg",
      intent: result?.intent?.displayName ?? null,
      confidence: result?.intentDetectionConfidence ?? 0,
    };
  } catch (err) {
    console.error("[chatbot] Echec Dialogflow, utilisation du fallback local:", err);
    return getFallbackIntent(message);
  }
}
