import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { emailService } from "../services/email.service.js";
import { addEmailJob } from "../queues/email.queue.js";
import { AppError } from "../utils/AppError.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";

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

  // TODO: Implémenter l'envoi via Firebase Cloud Messaging
  res.status(StatusCodes.OK).json(
    jsonResponse({
      status: "success",
      message: "Notification push simulée (intégration FCM à venir)",
      data: { token, title, body },
    })
  );
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

  res.status(StatusCodes.OK).json(
    jsonResponse({
      status: "success",
      message: "Notifications multiples simulées (intégration FCM à venir)",
      data: { success_count: tokens.length, failure_count: 0 },
    })
  );
});

export const subscribeToTopic = controllerWrapper(async (req: Request, res: Response) => {
  const { token, topic } = req.body as { token: string; topic: string };

  if (!token || !topic) {
    throw new AppError("Champs requis : token, topic", StatusCodes.BAD_REQUEST);
  }

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: `Abonné au topic "${topic}" (simulé)` })
  );
});

export const unsubscribeFromTopic = controllerWrapper(async (req: Request, res: Response) => {
  const { token, topic } = req.body as { token: string; topic: string };

  if (!token || !topic) {
    throw new AppError("Champs requis : token, topic", StatusCodes.BAD_REQUEST);
  }

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: `Désabonné du topic "${topic}" (simulé)` })
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

  res.status(StatusCodes.OK).json(
    jsonResponse({
      status: "success",
      message: `Notification envoyée au topic "${topic}" (simulée)`,
    })
  );
});
