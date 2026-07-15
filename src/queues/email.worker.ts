import { Worker, type Job } from "bullmq";
import { redisForWorker } from "../config/redis.js";
import { emailService } from "../services/email.service.js";
import { pandadocService } from "../services/pandadoc.service.js";
import { weeklyDigestService } from "../services/weeklyDigest.service.js";
import { addEmailJob, type EmailJobData } from "./email.queue.js";
import { logger } from "../utils/logger.js";

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const d = job.data;
  const target = "to" in d ? d.to : "(campagne)";
  logger.info(`[email-queue] processing job ${job.id} (${d.type} → ${target})`);

  switch (d.type) {
    case "welcome-user":
      await emailService.sendWelcomeUser(d.to, { userName: d.userName });
      break;

    case "welcome-organizer": {
      let pandadocSigningUrl: string | undefined = d.pandadocSigningUrl;
      if (!pandadocSigningUrl) {
        try {
          pandadocSigningUrl = await pandadocService.createOrganizerContract({
            name: d.organizerName,
            email: d.to,
          });
        } catch (err) {
          console.error("[pandadoc] Échec création contrat, email envoyé sans lien de signature:", err);
        }
      }
      await emailService.sendWelcomeOrganizer(d.to, {
        organizerName: d.organizerName,
        contractHtml: d.contractHtml,
        pandadocSigningUrl,
      });
      break;
    }

    case "ticket-confirmation":
      await emailService.sendTicketConfirmation(d.to, d.data);
      break;

    case "password-changed":
      await emailService.sendPasswordChanged(d.to, { userName: d.userName });
      break;

    case "event-reminder":
      await emailService.sendEventReminder(d.to, d.data);
      break;

    case "generic":
      await emailService.send(d.to, d.subject, d.html);
      break;

    case "weekly-digest":
      await emailService.sendWeeklyDigest(d.to, { content: d.content, unsubscribeUrl: d.unsubscribeUrl });
      break;

    case "weekly-digest-campaign": {
      const apiUrl = (process.env.API_URL || "https://back-feeti.onrender.com").replace(/\/$/, "");
      const [recipients, content] = await Promise.all([
        weeklyDigestService.resolveAudience(),
        weeklyDigestService.buildContent(),
      ]);
      logger.info(`[weekly-digest] campagne : ${recipients.length} destinataire(s)`);
      for (const r of recipients) {
        await addEmailJob({
          type: "weekly-digest",
          to: r.email,
          content,
          unsubscribeUrl: `${apiUrl}/api/newsletter/unsubscribe/${r.unsubscribeToken}`,
        });
      }
      break;
    }
  }
}

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>("emails", processEmailJob, {
    connection: redisForWorker,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    const target = "to" in job.data ? job.data.to : "(campagne)";
    logger.info(`[email-queue] ✓ job ${job.id} (${job.data.type} → ${target})`);
  });

  worker.on("failed", (job, err) => {
    const attempts = job?.attemptsMade ?? "?";
    console.error(`[email-queue] ✗ job ${job?.id} (${job?.data?.type}) tentative ${attempts} — ${err.message}`);
  });

  worker.on("error", (err) => {
    console.error(`[email-queue] worker error — ${err.message}`, err);
  });

  logger.info("[email-queue] worker démarré (concurrency: 5)");
  return worker;
}
