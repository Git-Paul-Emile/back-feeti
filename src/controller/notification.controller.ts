import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { emailService } from "../services/email.service.js";
import { weeklyDigestService } from "../services/weeklyDigest.service.js";
import { newsletterRepository } from "../repositories/newsletter.repository.js";
import { addEmailJob } from "../queues/email.queue.js";
import { AppError } from "../utils/AppError.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import { messaging } from "../config/firebase-admin.js";
import { logger } from "../utils/logger.js";

// ── Email ────────────────────────────────────────────────────────────────────

export const sendEmail = controllerWrapper(async (req: Request, res: Response) => {
  const { to, subject, html, text, from } = req.body as {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
  };

  if (!to || !subject || !html) {
    throw new AppError("Champs requis : to, subject, html", StatusCodes.BAD_REQUEST);
  }

  if (Array.isArray(to) && to.length === 0) {
    throw new AppError("La liste des destinataires ne peut pas être vide", StatusCodes.BAD_REQUEST);
  }

  if (text && html) {
    await addEmailJob({
      type: "generic",
      to: Array.isArray(to) ? to[0] : to,
      subject,
      html,
    });
  } else {
    const recipients = Array.isArray(to) ? to : [to];
    for (const recipient of recipients) {
      await emailService.send(recipient, subject, html);
    }
  }

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Email envoyé", data: { to } })
  );
});

export const sendTicketConfirmationEmail = controllerWrapper(async (req: Request, res: Response) => {
  const {
    to,
    customerName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    orderId,
    tickets,
    totalAmount,
    currency,
  } = req.body as {
    to: string;
    customerName: string;
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    eventLocation: string;
    orderId: string;
    tickets: { id: string; category: string; price: number; qrDataUrl?: string }[];
    totalAmount: number;
    currency: string;
  };

  if (!to || !customerName || !eventTitle) {
    throw new AppError("Champs requis : to, customerName, eventTitle", StatusCodes.BAD_REQUEST);
  }

  await emailService.sendTicketConfirmation(to, {
    holderName: customerName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    orderId,
    tickets: tickets.map(t => ({
      id: t.id,
      category: t.category,
      price: t.price,
      currency,
      qrDataUrl: t.qrDataUrl,
    })),
    totalAmount,
    currency,
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Email de confirmation envoyé" })
  );
});

export const sendEventReminderEmail = controllerWrapper(async (req: Request, res: Response) => {
  const {
    to,
    holderName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    ticketCount,
  } = req.body as {
    to: string;
    holderName: string;
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    eventLocation: string;
    ticketCount: number;
  };

  if (!to || !holderName || !eventTitle) {
    throw new AppError("Champs requis : to, holderName, eventTitle", StatusCodes.BAD_REQUEST);
  }

  await addEmailJob({
    type: "event-reminder",
    to,
    data: { holderName, eventTitle, eventDate, eventTime, eventLocation, ticketCount },
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Rappel email programmé" })
  );
});

// Newsletter "Les Fééties de la semaine" :
//  - avec { testEmail } : envoi immédiat et synchrone à une seule adresse (test/QA)
//  - sans testEmail : déclenche la campagne complète pour toute l'audience (async, via la queue)
export const sendWeeklyDigestEmail = controllerWrapper(async (req: Request, res: Response) => {
  const { testEmail } = req.body as { testEmail?: string };

  if (testEmail) {
    const [subscriber, content] = await Promise.all([
      newsletterRepository.subscribe(testEmail, "test"),
      weeklyDigestService.buildContent(),
    ]);
    const apiUrl = (process.env.API_URL || "https://back-feeti.onrender.com").replace(/\/$/, "");
    await emailService.sendWeeklyDigest(testEmail, {
      content,
      unsubscribeUrl: `${apiUrl}/api/newsletter/unsubscribe/${subscriber.unsubscribeToken}`,
    });
    res.status(StatusCodes.OK).json(
      jsonResponse({ status: "success", message: `Email de test envoyé à ${testEmail}`, data: { to: testEmail } })
    );
    return;
  }

  await addEmailJob({ type: "weekly-digest-campaign" });
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Campagne newsletter hebdomadaire déclenchée" })
  );
});

// ── SMS ──────────────────────────────────────────────────────────────────────

export const sendSMS = controllerWrapper(async (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "SMS simulé (intégration Twilio à venir)" })
  );
});

export const sendTicketConfirmationSMS = controllerWrapper(async (req: Request, res: Response) => {
  const { to, eventTitle, eventDate, ticketUrl } = req.body as {
    to: string;
    eventTitle: string;
    eventDate: string;
    ticketUrl: string;
  };

  if (!to || !eventTitle) {
    throw new AppError("Champs requis : to, eventTitle", StatusCodes.BAD_REQUEST);
  }

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "SMS simulé (intégration Twilio à venir)" })
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────

export const sendPushNotification = controllerWrapper(async (req: Request, res: Response) => {
  const { token, title, body, data, imageUrl } = req.body as {
    token: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    imageUrl?: string;
  };

  if (!token || !title || !body) {
    throw new AppError("Champs requis : token, title, body", StatusCodes.BAD_REQUEST);
  }

  try {
    const messageId = await messaging.send({
      token,
      notification: { title, body, ...(imageUrl && { imageUrl }) },
      ...(data && { data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) }),
    });
    res.status(StatusCodes.OK).json(
      jsonResponse({ status: "success", message: "Notification push envoyée", data: { messageId } })
    );
  } catch (err) {
    logger.error("[FCM] Échec envoi notification push:", err);
    throw new AppError("Échec de l'envoi de la notification push", StatusCodes.BAD_GATEWAY);
  }
});

export const sendPushMultiple = controllerWrapper(async (req: Request, res: Response) => {
  const { tokens, title, body, data } = req.body as {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, any>;
  };

  if (!tokens || tokens.length === 0 || !title || !body) {
    throw new AppError("Champs requis : tokens[], title, body", StatusCodes.BAD_REQUEST);
  }

  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    ...(data && { data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) }),
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({
      status: "success",
      message: "Notifications envoyées",
      data: { success_count: result.successCount, failure_count: result.failureCount },
    })
  );
});

export const subscribeToTopic = controllerWrapper(async (req: Request, res: Response) => {
  const { token, topic } = req.body as { token: string; topic: string };

  if (!token || !topic) {
    throw new AppError("Champs requis : token, topic", StatusCodes.BAD_REQUEST);
  }

  await messaging.subscribeToTopic([token], topic);

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: `Abonné au topic "${topic}"` })
  );
});

export const unsubscribeFromTopic = controllerWrapper(async (req: Request, res: Response) => {
  const { token, topic } = req.body as { token: string; topic: string };

  if (!token || !topic) {
    throw new AppError("Champs requis : token, topic", StatusCodes.BAD_REQUEST);
  }

  await messaging.unsubscribeFromTopic([token], topic);

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: `Désabonné du topic "${topic}"` })
  );
});

export const sendToTopic = controllerWrapper(async (req: Request, res: Response) => {
  const { topic, title, body, data } = req.body as {
    topic: string;
    title: string;
    body: string;
    data?: Record<string, any>;
  };

  if (!topic || !title || !body) {
    throw new AppError("Champs requis : topic, title, body", StatusCodes.BAD_REQUEST);
  }

  const messageId = await messaging.send({
    topic,
    notification: { title, body },
    ...(data && { data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) }),
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({
      status: "success",
      message: `Notification envoyée au topic "${topic}"`,
      data: { messageId },
    })
  );
});
