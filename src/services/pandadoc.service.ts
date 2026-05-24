const BASE_URL = "https://api.pandadoc.com/public/v1";

function headers() {
  return {
    Authorization: `API-Key ${process.env.PANDADOC_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function pandaFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...((options.headers as Record<string, string>) ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PandaDoc ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function waitForDraft(documentId: string, maxAttempts = 12): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const doc = await pandaFetch<{ status: string }>(`/documents/${documentId}`);
    if (doc.status === "document.draft") return;
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error(`[pandadoc] Document ${documentId} n'a pas atteint le statut draft`);
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") || "-" };
}

export const pandadocService = {
  /**
   * Crée un contrat de partenariat depuis le template PandaDoc,
   * l'envoie en signature silencieuse, et retourne le lien de signature du promoteur.
   */
  async createOrganizerContract(organizer: { name: string; email: string }): Promise<string> {
    const promoteur = splitName(organizer.name);
    const directeur = splitName(process.env.PANDADOC_DIRECTOR_NAME ?? "Directeur Féeti");

    // 1. Créer le document depuis le template
    const doc = await pandaFetch<{ id: string }>("/documents", {
      method: "POST",
      body: JSON.stringify({
        name: `Contrat partenariat Féeti — ${organizer.name}`,
        template_uuid: process.env.PANDADOC_TEMPLATE_ID,
        recipients: [
          {
            email: organizer.email,
            first_name: promoteur.firstName,
            last_name: promoteur.lastName,
            role: "Promoteur",
            signing_order: 1,
          },
          {
            email: process.env.PANDADOC_DIRECTOR_EMAIL,
            first_name: directeur.firstName,
            last_name: directeur.lastName,
            role: "Directeur",
            signing_order: 2,
          },
        ],
      }),
    });

    const documentId = doc.id;

    // 2. Attendre que le document soit prêt (statut "document.draft")
    await waitForDraft(documentId);

    // 3. Envoyer pour signature (silent=true : Féeti gère l'email, pas PandaDoc)
    await pandaFetch(`/documents/${documentId}/send`, {
      method: "POST",
      body: JSON.stringify({
        message: "Veuillez signer votre contrat de partenariat Féeti.",
        silent: true,
      }),
    });

    // 4. Créer une session de signature pour le promoteur (valable 7 jours)
    const session = await pandaFetch<{ id: string }>(`/documents/${documentId}/session`, {
      method: "POST",
      body: JSON.stringify({
        recipient: organizer.email,
        lifetime: 7 * 24 * 3600,
      }),
    });

    return `https://app.pandadoc.com/s/${session.id}`;
  },
};
