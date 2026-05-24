import { Worker, type Job } from "bullmq";
import { redisForWorker } from "../config/redis.js";
import { emailService } from "../services/email.service.js";
import { pandadocService } from "../services/pandadoc.service.js";
import type { EmailJobData } from "./email.queue.js";

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const d = job.data;
  console.log(`[email-queue] processing job ${job.id} (${d.type} → ${d.to})`);

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

    case "password-reset":
      await emailService.sendPasswordReset(d.to, { userName: d.userName, resetUrl: d.resetUrl });
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
  }
}

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>("emails", processEmailJob, {
    connection: redisForWorker,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`[email-queue] ✓ job ${job.id} (${job.data.type} → ${job.data.to})`);
  });

  worker.on("failed", (job, err) => {
    const attempts = job?.attemptsMade ?? "?";
    console.error(`[email-queue] ✗ job ${job?.id} (${job?.data?.type}) tentative ${attempts} — ${err.message}`);
  });

  worker.on("error", (err) => {
    console.error(`[email-queue] worker error — ${err.message}`, err);
  });

  console.log("[email-queue] worker démarré (concurrency: 5)");
  return worker;
}
