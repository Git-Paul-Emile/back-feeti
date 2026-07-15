/**
 * Test manuel de la newsletter hebdomadaire "Les Fééties de la semaine".
 * Construit le contenu réel (depuis la base de données) et envoie un email
 * de test à l'adresse fournie, via le provider configuré (Resend par défaut).
 *
 * Usage :
 *   npx tsx scripts/test-weekly-digest.ts apeckouet@gmail.com
 *   (ou : npm run test:weekly-digest -- apeckouet@gmail.com)
 */
import dotenv from "dotenv";
dotenv.config();

import { weeklyDigestService } from "../src/services/weeklyDigest.service.js";
import { emailService } from "../src/services/email.service.js";
import { newsletterRepository } from "../src/repositories/newsletter.repository.js";

const testEmail = process.argv[2];

if (!testEmail) {
  console.error("Usage : npx tsx scripts/test-weekly-digest.ts <email>");
  process.exit(1);
}

async function main() {
  console.log(`[weekly-digest] Provider email : ${process.env.EMAIL_PROVIDER || "resend"}`);
  console.log(`[weekly-digest] Construction du contenu (événements, deals, replay) depuis la base...`);

  const content = await weeklyDigestService.buildContent();
  console.log(`[weekly-digest] Contenu : ${content.topEvents.length} top events, ${content.mustSee.length} "à ne pas rater", ${content.liveEvents.length} live streaming, replay ${content.replay ? "disponible" : "absent"}, ${content.dealsCount} bons plans actifs.`);

  const subscriber = await newsletterRepository.subscribe(testEmail, "test");
  const apiUrl = (process.env.API_URL || "https://back-feeti.onrender.com").replace(/\/$/, "");
  const unsubscribeUrl = `${apiUrl}/api/newsletter/unsubscribe/${subscriber.unsubscribeToken}`;

  console.log(`[weekly-digest] Envoi à ${testEmail}...`);
  await emailService.sendWeeklyDigest(testEmail, { content, unsubscribeUrl });
  console.log(`[weekly-digest] ✓ Email envoyé avec succès à ${testEmail}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[weekly-digest] ✗ Échec de l'envoi :", err);
  process.exit(1);
});
