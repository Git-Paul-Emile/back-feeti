import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { contactRequestSchema, type ContactRequest } from "../validators/contact.validator.js";
import { emailService } from "../services/email.service.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import { logger } from "../utils/logger.js";

const REASON_LABELS: Record<ContactRequest["reason"], string> = {
  ticketing: "Vendre des billets sur Féeti",
  partnership: "Partenariat",
  advertising: "Annonceur / publicité",
  press: "Presse & médias",
  support: "Support",
  other: "Autre",
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function buildEmail(data: ContactRequest): string {
  const rows: [string, string][] = [
    ["Nom", `${data.firstName} ${data.lastName}`],
    ["Email", data.email],
    ["Téléphone", data.phone],
    ["Société", data.company],
    ["Secteur", data.vertical],
    ["Pays", data.country],
    ["Billets payants prévus / an", data.ticketsPerYear || "—"],
    ["Prix moyen d'un billet", data.averagePrice || "—"],
    ["Motif", REASON_LABELS[data.reason]],
  ];
  const table = rows
    .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#6b7280;">${k}</td><td style="padding:6px 12px;color:#111827;font-weight:600;">${escapeHtml(v)}</td></tr>`)
    .join("");
  const message = data.message
    ? `<p style="margin:20px 0 6px;color:#6b7280;">Message</p><p style="margin:0;white-space:pre-wrap;color:#111827;">${escapeHtml(data.message)}</p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:600px;">
    <h2 style="color:#03033b;">Nouvelle demande de contact — Féeti</h2>
    <table cellpadding="0" cellspacing="0">${table}</table>${message}</div>`;
}

// Public — formulaire de la page Contact.
export const submitContactRequest = controllerWrapper(async (req: Request, res: Response) => {
  const data = contactRequestSchema.parse(req.body);
  const to = process.env.CONTACT_EMAIL || "contact@feeti.io";

  await emailService.send(to, `[Contact] ${REASON_LABELS[data.reason]} — ${data.company}`, buildEmail(data));
  logger.info(`[contact] demande transmise (${data.reason}) pour ${data.email}`);

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Votre demande a bien été envoyée" })
  );
});
