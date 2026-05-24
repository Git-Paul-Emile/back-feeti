/**
 * ═══════════════════════════════════════════════════════════════════════
 *  SERVICE EMAIL — ARCHITECTURE PLUGGABLE
 *  Pour changer de provider (SendGrid, Resend, etc.), implémenter
 *  IEmailProvider et changer la factory getEmailProvider().
 * ═══════════════════════════════════════════════════════════════════════
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// ─── Interface commune (swappable) ────────────────────────────────────

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: string | Buffer; encoding?: string; contentType?: string }[];
}

export interface IEmailProvider {
  send(options: EmailOptions): Promise<void>;
}

// ─── Provider Nodemailer (SMTP) ───────────────────────────────────────

class NodemailerProvider implements IEmailProvider {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    return this.transporter;
  }

  async send(options: EmailOptions): Promise<void> {
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "Féeti <noreply@feeti.app>";

    await this.getTransporter().sendMail({
      from: fromAddress,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    });
  }
}

// ─── Factory — pour ajouter SendGrid : implémenter IEmailProvider ─────

function getEmailProvider(): IEmailProvider {
  const provider = process.env.EMAIL_PROVIDER || "nodemailer";
  switch (provider) {
    case "nodemailer":
    default:
      return new NodemailerProvider();
  }
}

// ─── Templates HTML ───────────────────────────────────────────────────

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Féeti</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4338ca 0%,#7c3aed 100%);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">Féeti</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Vos billets, vos événements</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} Fééti.io , propulsé par Eroiste , Tous droits réservés.</p>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">
            <a href="#" style="color:#6366f1;text-decoration:none;">Se désabonner</a> ·
            <a href="#" style="color:#6366f1;text-decoration:none;">Politique de confidentialité</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function templateTicketConfirmation(data: {
  holderName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  orderId: string;
  tickets: { id: string; category: string; price: number; currency: string; qrDataUrl?: string }[];
  totalAmount: number;
  currency: string;
}): string {
  const ticketRows = data.tickets
    .map(
      (t, i) => `
    <div style="border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;bottom:0;width:6px;background:linear-gradient(135deg,#4338ca,#7c3aed);border-radius:0;"></div>
      <div style="margin-left:16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div>
            <p style="margin:0;font-size:14px;color:#6b7280;">Billet ${i + 1}</p>
            <p style="margin:2px 0 0;font-size:18px;font-weight:700;color:#111827;">${t.category.toUpperCase()}</p>
          </div>
          <div style="text-align:right;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#4338ca;">${t.price.toLocaleString("fr-FR")} ${t.currency}</p>
          </div>
        </div>
        ${
          t.qrDataUrl
            ? `<div style="text-align:center;margin-top:12px;">
                <img src="${t.qrDataUrl}" alt="QR Code" style="width:160px;height:160px;border:1px solid #e5e7eb;border-radius:8px;padding:4px;"/>
                <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">Présentez ce QR code à l'entrée</p>
              </div>`
            : ""
        }
        <p style="margin:8px 0 0;font-size:11px;color:#6b7280;">ID : ${t.id}</p>
      </div>
    </div>`
    )
    .join("");

  return baseLayout(`
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:#dcfce7;border-radius:50%;padding:16px;margin-bottom:16px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2 style="margin:0;font-size:24px;font-weight:700;color:#111827;">Paiement confirmé !</h2>
      <p style="margin:8px 0 0;color:#6b7280;font-size:16px;">Merci ${data.holderName}, vos billets sont prêts.</p>
    </div>

    <div style="background:#f0f9ff;border-radius:10px;padding:20px;margin-bottom:28px;">
      <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0369a1;">Détails de l'événement</h3>
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;width:120px;">Événement</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${data.eventTitle}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:4px 0;color:#111827;font-size:14px;">${data.eventDate}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Heure</td><td style="padding:4px 0;color:#111827;font-size:14px;">${data.eventTime}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Lieu</td><td style="padding:4px 0;color:#111827;font-size:14px;">${data.eventLocation}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Commande</td><td style="padding:4px 0;color:#111827;font-size:14px;font-family:monospace;">${data.orderId}</td></tr>
      </table>
    </div>

    <h3 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#111827;">Vos billets (${data.tickets.length})</h3>
    ${ticketRows}

    <div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:16px;margin-top:24px;">
      <p style="margin:0;font-size:14px;color:#713f12;text-align:center;">
        <strong>Important :</strong> Présentez le QR code à l'entrée de l'événement.
        Chaque billet n'est valable qu'une seule fois.
      </p>
    </div>

    <div style="text-align:right;margin-top:24px;padding-top:16px;border-top:2px solid #e5e7eb;">
      <p style="margin:0;font-size:20px;font-weight:800;color:#111827;">
        Total payé : <span style="color:#4338ca;">${data.totalAmount.toLocaleString("fr-FR")} ${data.currency}</span>
      </p>
    </div>
  `);
}

export function templatePasswordReset(data: { userName: string; resetUrl: string }): string {
  return baseLayout(`
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">Réinitialisation du mot de passe</h2>
    <p style="color:#6b7280;font-size:16px;margin-bottom:28px;">Bonjour ${data.userName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin-bottom:28px;">
      Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.
      Ce lien est valable pendant <strong>1 heure</strong>.
    </p>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${data.resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#4338ca,#7c3aed);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600;">
        Réinitialiser mon mot de passe
      </a>
    </div>
    <p style="color:#9ca3af;font-size:13px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe ne sera pas modifié.</p>
  `);
}

export function templateWelcomeUser(data: { userName: string }): string {
  return baseLayout(`
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:#ede9fe;border-radius:50%;padding:16px;margin-bottom:16px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
      <h2 style="margin:0;font-size:24px;font-weight:700;color:#111827;">Bienvenue sur Féeti, ${data.userName} !</h2>
      <p style="margin:10px 0 0;color:#6b7280;font-size:16px;">Votre compte a été créé avec succès.</p>
    </div>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin-bottom:24px;">
      Vous pouvez dès maintenant explorer les événements près de chez vous, acheter vos billets et vivre des expériences inoubliables.
    </p>
    <div style="background:#f5f3ff;border-radius:10px;padding:20px;margin-bottom:28px;">
      <h3 style="margin:0 0 12px;font-size:15px;font-weight:600;color:#7c3aed;">Ce que vous pouvez faire :</h3>
      <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2;">
        <li>Découvrir et réserver des événements</li>
        <li>Recevoir vos billets avec QR code directement par email</li>
        <li>Suivre vos commandes depuis votre profil</li>
      </ul>
    </div>
    <p style="color:#9ca3af;font-size:13px;margin:0;">
      Si vous n'êtes pas à l'origine de cette inscription, contactez-nous immédiatement.
    </p>
  `);
}

export function templateWelcomeOrganizer(data: { organizerName: string; contractHtml?: string; pandadocSigningUrl?: string }): string {
  return baseLayout(`
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:#fef3c7;border-radius:50%;padding:16px;margin-bottom:16px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
      </div>
      <h2 style="margin:0;font-size:24px;font-weight:700;color:#111827;">Bienvenue sur Féeti, ${data.organizerName} !</h2>
      <p style="margin:10px 0 0;color:#6b7280;font-size:16px;">Votre compte organisateur a été créé avec succès.</p>
    </div>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin-bottom:24px;">
      Vous pouvez désormais créer et gérer vos événements, suivre vos ventes et encaisser vos revenus directement depuis votre tableau de bord Féeti.
    </p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:20px;margin-bottom:28px;">
      <h3 style="margin:0 0 12px;font-size:15px;font-weight:600;color:#92400e;">Vos outils organisateur :</h3>
      <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2;">
        <li>Création et publication d'événements</li>
        <li>Gestion des catégories de billets et des stocks</li>
        <li>Tableau de bord financier en temps réel</li>
        <li>Contrôle d'accès QR multi-zones (Feeti Access)</li>
        <li>Suivi des participants et rapports de vente</li>
      </ul>
    </div>
    ${data.pandadocSigningUrl ? `
    <div style="background:linear-gradient(135deg,#fef3c7,#fffbeb);border:2px solid #f59e0b;border-radius:12px;padding:28px;margin-top:28px;text-align:center;">
      <div style="display:inline-block;background:#f59e0b;border-radius:50%;padding:10px;margin-bottom:12px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      </div>
      <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#92400e;">Signez votre contrat de partenariat</h3>
      <p style="margin:0 0 20px;color:#78350f;font-size:14px;line-height:1.6;">
        Pour finaliser votre partenariat avec Féeti, veuillez lire et signer<br/>le contrat ci-dessous. Cette étape est obligatoire pour publier vos événements.
      </p>
      <a href="${data.pandadocSigningUrl}" style="display:inline-block;background:linear-gradient(135deg,#d97706,#f59e0b);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
        ✍️ Signer mon contrat
      </a>
      <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">
        Ce lien est valable 7 jours. Après votre signature, le directeur Féeti contresignera.
      </p>
    </div>` : ""}
    ${data.contractHtml ? `
    <div style="border-top:2px solid #e5e7eb;padding-top:24px;margin-top:24px;">
      <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;">Contrat organisateur</h3>
      ${data.contractHtml}
    </div>` : ""}
    <p style="color:#9ca3af;font-size:13px;margin:${data.pandadocSigningUrl || data.contractHtml ? "24px" : "0"} 0 0;">
      Si vous n'êtes pas à l'origine de cette inscription, contactez-nous immédiatement.
    </p>
  `);
}

export function templatePasswordChanged(data: { userName: string }): string {
  return baseLayout(`
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">Mot de passe modifié</h2>
    <p style="color:#6b7280;font-size:16px;margin-bottom:28px;">Bonjour ${data.userName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin-bottom:28px;">
      Le mot de passe de votre compte Féeti vient d'être modifié avec succès.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#991b1b;font-size:14px;">
        <strong>Ce n'était pas vous ?</strong> Contactez immédiatement notre support et sécurisez votre compte.
      </p>
    </div>
    <p style="color:#9ca3af;font-size:13px;margin:0;">Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
  `);
}

export function templateEventReminder(data: {
  holderName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  ticketCount: number;
}): string {
  return baseLayout(`
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">Rappel : Votre événement est demain !</h2>
    <p style="color:#6b7280;font-size:16px;margin-bottom:28px;">Bonjour ${data.holderName},</p>
    <div style="background:#faf5ff;border:1px solid #d8b4fe;border-radius:10px;padding:24px;margin-bottom:24px;">
      <h3 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#7c3aed;">${data.eventTitle}</h3>
      <table cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;width:80px;">Date</td><td style="padding:4px 0;color:#111827;font-size:15px;font-weight:600;">${data.eventDate}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Heure</td><td style="padding:4px 0;color:#111827;font-size:15px;font-weight:600;">${data.eventTime}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Lieu</td><td style="padding:4px 0;color:#111827;font-size:15px;font-weight:600;">${data.eventLocation}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Billets</td><td style="padding:4px 0;color:#111827;font-size:15px;font-weight:600;">${data.ticketCount} billet(s)</td></tr>
      </table>
    </div>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      N'oubliez pas votre billet ! Ouvrez l'application Féeti ou retrouvez le QR code dans votre email de confirmation.
    </p>
  `);
}

// ─── Service singleton ─────────────────────────────────────────────────

class EmailService {
  private provider: IEmailProvider = getEmailProvider();

  async sendTicketConfirmation(
    to: string,
    data: Parameters<typeof templateTicketConfirmation>[0]
  ): Promise<void> {
    await this.provider.send({
      to,
      subject: `✅ Vos billets pour « ${data.eventTitle} » — Commande #${data.orderId.slice(0, 8).toUpperCase()}`,
      html: templateTicketConfirmation(data),
      text: `Bonjour ${data.holderName}, vos billets pour ${data.eventTitle} sont confirmés. Commande: ${data.orderId}`,
    });
  }

  async sendPasswordReset(to: string, data: Parameters<typeof templatePasswordReset>[0]): Promise<void> {
    await this.provider.send({
      to,
      subject: "Réinitialisation de votre mot de passe Féeti",
      html: templatePasswordReset(data),
      text: `Lien de réinitialisation : ${data.resetUrl}`,
    });
  }

  async sendEventReminder(to: string, data: Parameters<typeof templateEventReminder>[0]): Promise<void> {
    await this.provider.send({
      to,
      subject: `Rappel : « ${data.eventTitle} » est demain !`,
      html: templateEventReminder(data),
      text: `Rappel : ${data.eventTitle} le ${data.eventDate} à ${data.eventTime} — ${data.eventLocation}`,
    });
  }

  async sendWelcomeUser(to: string, data: Parameters<typeof templateWelcomeUser>[0]): Promise<void> {
    await this.provider.send({
      to,
      subject: `Bienvenue sur Féeti, ${data.userName} !`,
      html: templateWelcomeUser(data),
      text: `Bienvenue ${data.userName} ! Votre compte Féeti a été créé avec succès.`,
    });
  }

  async sendWelcomeOrganizer(to: string, data: Parameters<typeof templateWelcomeOrganizer>[0]): Promise<void> {
    const signingText = data.pandadocSigningUrl
      ? ` Signez votre contrat de partenariat ici : ${data.pandadocSigningUrl}`
      : "";
    await this.provider.send({
      to,
      subject: `Bienvenue sur Féeti Organisateur, ${data.organizerName} !`,
      html: templateWelcomeOrganizer(data),
      text: `Bienvenue ${data.organizerName} ! Votre compte organisateur Féeti a été créé.${signingText}`,
    });
  }

  async sendPasswordChanged(to: string, data: Parameters<typeof templatePasswordChanged>[0]): Promise<void> {
    await this.provider.send({
      to,
      subject: "Votre mot de passe Féeti a été modifié",
      html: templatePasswordChanged(data),
      text: `Bonjour ${data.userName}, votre mot de passe a été modifié. Si ce n'était pas vous, contactez-nous immédiatement.`,
    });
  }

  // Méthode générique pour extensions futures
  async send(to: string, subject: string, html: string): Promise<void> {
    await this.provider.send({ to, subject, html });
  }
}

export const emailService = new EmailService();
