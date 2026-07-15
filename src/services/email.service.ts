/**
 * ═══════════════════════════════════════════════════════════════════════
 *  SERVICE EMAIL — ARCHITECTURE PLUGGABLE
 *  Provider actif : Resend (RESEND_API_KEY). Nodemailer est conservé plus
 *  bas (commenté) au cas où il faudrait revenir en arrière.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { Resend } from "resend";
import { RESET_PASSWORD_ART, OTP_ART } from "./email.assets.js";
import type { WeeklyDigestContent, DigestEventCard } from "./weeklyDigest.service.js";
// import nodemailer from "nodemailer";
// import type { Transporter } from "nodemailer";

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

// ─── Provider Resend (actif) ───────────────────────────────────────────

class ResendProvider implements IEmailProvider {
  private client: Resend | null = null;

  private getClient(): Resend {
    if (!this.client) {
      this.client = new Resend(process.env.RESEND_API_KEY);
    }
    return this.client;
  }

  async send(options: EmailOptions): Promise<void> {
    const fromAddress = process.env.EMAIL_FROM || process.env.RESEND_FROM || "Féeti <noreply@feeti.app>";

    const { error } = await this.getClient().emails.send({
      from: fromAddress,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });

    if (error) {
      throw new Error(`[resend] échec d'envoi vers ${Array.isArray(options.to) ? options.to.join(", ") : options.to} : ${error.message}`);
    }
  }
}

// ─── Provider Nodemailer (SMTP) — désactivé, conservé pour rollback ────
//
// class NodemailerProvider implements IEmailProvider {
//   private transporter: Transporter | null = null;
//
//   private getTransporter(): Transporter {
//     if (!this.transporter) {
//       this.transporter = nodemailer.createTransport({
//         host: process.env.SMTP_HOST || "smtp.gmail.com",
//         port: Number(process.env.SMTP_PORT) || 587,
//         secure: Number(process.env.SMTP_PORT) === 465,
//         auth: {
//           user: process.env.SMTP_USER,
//           pass: process.env.SMTP_PASS,
//         },
//       });
//     }
//     return this.transporter;
//   }
//
//   async send(options: EmailOptions): Promise<void> {
//     const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "Féeti <noreply@feeti.app>";
//
//     await this.getTransporter().sendMail({
//       from: fromAddress,
//       to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
//       subject: options.subject,
//       html: options.html,
//       text: options.text,
//       attachments: options.attachments,
//     });
//   }
// }

// ─── Factory — pour ajouter un autre provider : implémenter IEmailProvider ─

function getEmailProvider(): IEmailProvider {
  const provider = process.env.EMAIL_PROVIDER || "resend";
  switch (provider) {
    // case "nodemailer":
    //   return new NodemailerProvider();
    case "resend":
    default:
      return new ResendProvider();
  }
}

// ─── Design system commun (identique aux maquettes Féeti) ─────────────

// Logo hébergé sur le front en production. On force volontairement cette URL
// (indépendante de FRONT_URL) car FRONT_URL vaut souvent http://localhost:3000
// en dev — une adresse que Gmail/Outlook ne peuvent pas atteindre pour charger
// l'image. EMAIL_LOGO_BASE_URL permet de la surcharger si besoin (staging...).
const EMAIL_ASSET_BASE_URL = process.env.EMAIL_LOGO_BASE_URL || "https://front-feeti.vercel.app";
const FRONT_URL = process.env.FRONT_URL || "https://front-feeti.vercel.app";
const API_URL = process.env.API_URL || "https://back-feeti.onrender.com";
const LOGO_URL = `${EMAIL_ASSET_BASE_URL}/logo.png`;
const LOGO_WHITE_URL = `${EMAIL_ASSET_BASE_URL}/logo%20blanc.png`;

const NAVY = "#1e1b4b";
const SUBSCRIBER_BLUE = "#2b4a86";
const MINT = "#79c9ab";
const LINK_BLUE = "#2b5aa8";

// ─── Palette "Les Fééties de la semaine" — couleurs relevées sur la maquette ─
const DIGEST_CREAM = "#faf6f7";
const DIGEST_LIME = "#ceff70";
const DIGEST_TEAL = "#16bda0";
const DIGEST_RED = "#de0035";
const DIGEST_NAVY_BTN = "#190453";
const DIGEST_DARK = "#28272d";
const DIGEST_FOOTER_NAVY = "#03033b";
const DIGEST_FOOTER_MUTED = "#9a9bb0";
// Slices statiques de la maquette (illustrations non reproductibles fidèlement
// en HTML : logo + lunettes + titre bulle, photo héro, collage produits).
const DIGEST_HEADER_HERO_URL = `${EMAIL_ASSET_BASE_URL}/email/header-hero.jpg`;
const DIGEST_HERO_PHOTO_URL = `${EMAIL_ASSET_BASE_URL}/email/hero-photo.jpg`;
const DIGEST_BONPLAN_PHOTO_URL = `${EMAIL_ASSET_BASE_URL}/email/bonplan-products.jpg`;

// Gmail (et d'autres webmails) suppriment les balises <svg> des emails HTML :
// toutes les illustrations/icônes ci-dessous utilisent donc uniquement du
// texte/emoji et des formes CSS basiques (cercles via border-radius), qui sont
// supportés partout.

/** Petite illustration ballons + confettis (bandeau des mails de bienvenue). */
function celebrationArt(): string {
  return `<div style="font-size:40px;line-height:1;">🎈🎉✨🎊🎈</div>`;
}

/** Illustration "mot de passe" (undraw_enter-password) — pour le reset password (fond navy). */
function resetPasswordArt(): string {
  return `<img src="data:image/png;base64,${RESET_PASSWORD_ART.base64}" width="${RESET_PASSWORD_ART.width}" height="${RESET_PASSWORD_ART.height}" alt="" style="max-width:100%;height:auto;"/>`;
}

/** Illustration "double authentification" (undraw_two-factor-authentication) — pour le code OTP (fond gris clair). */
function otpArt(): string {
  return `<img src="data:image/png;base64,${OTP_ART.base64}" width="${OTP_ART.width}" height="${OTP_ART.height}" alt="" style="max-width:100%;height:auto;"/>`;
}

/** Badge rond avec une coche ou une croix — remplace les anciens SVG (non supportés par Gmail). */
function statusBadge(kind: "success" | "error"): string {
  const bg = kind === "success" ? "#dcfce7" : "#fee2e2";
  const color = kind === "success" ? "#16a34a" : "#dc2626";
  const glyph = kind === "success" ? "&#10003;" : "&#10005;";
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;"><tr>
    <td width="64" height="64" align="center" valign="middle" style="background:${bg};border-radius:50%;">
      <span style="color:${color};font-size:30px;font-weight:700;">${glyph}</span>
    </td>
  </tr></table>`;
}

/** Icône ronde de réseau social — table imbriquée (rendu fiable dans Gmail/Outlook). */
function socialIcon(bg: string, glyph: string, fontFamily = "Arial, sans-serif"): string {
  return `
  <td style="padding:0 5px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="34" height="34" align="center" valign="middle" style="background:${bg};border-radius:50%;font:700 13px ${fontFamily};color:#ffffff;line-height:1;">${glyph}</td>
    </tr></table>
  </td>`;
}

function socialIconsRow(): string {
  const facebook = socialIcon("#1877F2", "f", "Georgia, 'Times New Roman', serif");
  const instagram = socialIcon("#c1327a", "IG");
  const linkedin = socialIcon("#0A66C2", "in");
  const youtube = socialIcon("#FF0000", "&#9654;");
  const x = socialIcon("#000000", "X");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>${facebook}${instagram}${linkedin}${youtube}${x}</tr></table>`;
}

function emailTopBar(): string {
  return `
  <tr><td style="background:#ffffff;padding:20px 40px 0;text-align:center;">
    <a href="${FRONT_URL}" style="color:#9ca3af;font-size:12px;text-decoration:underline;">Afficher dans le navigateur</a>
  </td></tr>`;
}

function emailLogoHeader(art?: string): string {
  return `
  <tr><td style="background:#ffffff;padding:24px 40px ${art ? "0" : "24px"};text-align:center;">
    ${art ? `<div style="margin-bottom:8px;">${art}</div>` : ""}
    <img src="${LOGO_URL}" alt="Féeti" height="48" style="height:48px;width:auto;"/>
  </td></tr>
  ${art ? `<tr><td style="padding:0 40px 24px;"><div style="border-top:2px dashed #d1d5db;"></div></td></tr>` : ""}`;
}

/** Footer "réseaux sociaux" — mails transactionnels / sécurité. */
function emailFooterSocial(): string {
  return `
  <tr><td style="background:${NAVY};padding:32px 40px;text-align:center;">
    <p style="margin:0 0 20px;color:#e5e7eb;font-size:13px;line-height:1.7;">
      Ce lien est sécurisé et expirera automatiquement après un certain délai pour protéger votre compte.<br/>
      Si vous n'avez pas effectué cette demande, aucune action n'est nécessaire.
    </p>
    ${socialIconsRow()}
  </td></tr>`;
}

/** Footer "abonné" — mails de bienvenue (identique aux maquettes). */
function emailFooterSubscriber(recipientEmail?: string): string {
  return `
  <tr><td style="background:${SUBSCRIBER_BLUE};padding:32px 40px;">
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td valign="top" style="width:170px;">
          <div style="background:#ffffff;display:inline-block;padding:10px 14px;border-radius:4px;">
            <img src="${LOGO_URL}" alt="Féeti" height="28" style="height:28px;width:auto;"/>
          </div>
          <p style="margin:14px 0 0;color:#e5e7eb;font-size:12px;">promoteur@feeti.io | www.feeti.io</p>
        </td>
        <td valign="top" style="color:#e5e7eb;font-size:12px;line-height:1.7;">
          <p style="margin:0;">Cet email a été envoyé à <span style="background:#f4d35e;color:#1f2937;padding:1px 8px;border-radius:3px;">${recipientEmail || "votre adresse"}</span>.</p>
          <p style="margin:6px 0 0;">Vous avez reçu cet email parce que vous vous êtes inscrit à notre newsletter.</p>
        </td>
      </tr>
    </table>
  </td></tr>`;
}

function emailCopyright(): string {
  return `
  <tr><td style="background:#ffffff;padding:20px 40px;text-align:center;">
    <p style="margin:0;color:${LINK_BLUE};font-size:13px;">${new Date().getFullYear()} © feeti.io propulsé avec Eroïste</p>
  </td></tr>`;
}

type ShellOptions = {
  header?: "celebration" | "security-dark" | "security-light" | "plain";
  footer?: "social" | "subscriber";
  recipientEmail?: string;
  /** Titre affiché dans le bandeau (utilisé par les variantes security-*). */
  heroTitle?: string;
};

/**
 * Structure commune à tous les mails Féeti : barre "afficher dans le
 * navigateur", logo (+ illustration selon le cas), corps, footer, copyright.
 */
function baseLayout(content: string, opts: ShellOptions = {}): string {
  const header = opts.header || "plain";
  const footer = opts.footer || "social";

  let heroBlock = "";
  if (header === "celebration") {
    heroBlock = emailLogoHeader(celebrationArt());
  } else if (header === "security-dark") {
    heroBlock = `
    <tr><td style="background:${NAVY};padding:40px;text-align:center;">
      <img src="${LOGO_WHITE_URL}" alt="Féeti" height="40" style="height:40px;width:auto;"/>
      <div style="margin:24px 0 20px;">${resetPasswordArt()}</div>
      <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;">${opts.heroTitle || ""}</h1>
    </td></tr>`;
  } else if (header === "security-light") {
    heroBlock = `
    <tr><td style="background:#ffffff;padding:24px 40px 0;text-align:center;">
      <img src="${LOGO_URL}" alt="Féeti" height="40" style="height:40px;width:auto;"/>
    </td></tr>
    <tr><td style="background:#dadadd;padding:40px;text-align:center;">
      <div style="margin-bottom:20px;">${otpArt()}</div>
      <h1 style="margin:0;color:${NAVY};font-size:28px;font-weight:800;">${opts.heroTitle || ""}</h1>
    </td></tr>`;
  } else {
    heroBlock = emailLogoHeader();
  }

  const bodyBg = header === "security-dark" ? NAVY : header === "security-light" ? "#dadadd" : "#ffffff";
  const bodyColor = header === "security-dark" || header === "security-light" ? "#ffffff" : "#111827";
  const bodyTextColor = header === "security-dark" ? "#ffffff" : header === "security-light" ? NAVY : "#374151";

  const footerBlock = footer === "subscriber" ? emailFooterSubscriber(opts.recipientEmail) : emailFooterSocial();

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
        ${emailTopBar()}
        ${heroBlock}
        <tr><td style="background:${bodyBg};color:${bodyColor};padding:8px 40px 40px;">
          <div style="color:${bodyTextColor};">
            ${content}
          </div>
        </td></tr>
        ${footerBlock}
      </table>
      ${emailCopyright()}
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Templates HTML ───────────────────────────────────────────────────

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
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <p style="margin:0;font-size:13px;color:#6b7280;">Billet ${i + 1}</p>
            <p style="margin:2px 0 0;font-size:18px;font-weight:700;color:#111827;">${t.category.toUpperCase()}</p>
          </div>
          <div style="text-align:right;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#4338ca;">${t.price.toLocaleString("fr-FR")} ${t.currency}</p>
          </div>
        </div>
        <p style="margin:10px 0 4px;font-size:11px;color:#9ca3af;font-family:monospace;">Réf : ${t.id.slice(-12).toUpperCase()}</p>
        <a href="${API_URL}/api/tickets/${t.id}/download" style="display:inline-block;margin-top:12px;background:linear-gradient(135deg,#4338ca,#7c3aed);color:#ffffff;text-decoration:none;padding:9px 22px;border-radius:8px;font-size:14px;font-weight:600;">
          ⬇ Télécharger
        </a>
      </div>
    </div>`
    )
    .join("");

  return baseLayout(`
    <div style="text-align:center;margin-bottom:32px;">
      ${statusBadge("success")}
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


    <div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:16px;margin-top:8px;">
      <p style="margin:0;font-size:14px;color:#713f12;text-align:center;">
        <strong>Important :</strong> Le QR code d'entrée est disponible dans votre billet PDF.
        Présentez-le à l'entrée de l'événement. Chaque billet n'est valable qu'une seule fois.
      </p>
    </div>

    <div style="text-align:right;margin-top:24px;padding-top:16px;border-top:2px solid #e5e7eb;">
      <p style="margin:0;font-size:20px;font-weight:800;color:#111827;">
        Total payé : <span style="color:#4338ca;">${data.totalAmount.toLocaleString("fr-FR")} ${data.currency}</span>
      </p>
    </div>
  `, { footer: "social" });
}

export function templateWelcomeUser(data: { userName: string; email?: string }): string {
  return baseLayout(`
    <div style="text-align:center;margin-bottom:8px;">
      <h1 style="margin:0;font-size:28px;font-weight:800;color:${LINK_BLUE};line-height:1.25;">Bienvenue<br/>Chers Fééteur (se)</h1>
    </div>
    <p style="color:#1f2937;font-size:15px;line-height:1.8;margin:24px 0 0;">
      Bonjour ${data.userName},<br/>
      Votre compte Fééti est maintenant actif.<br/>
      Mais ici, il ne s'agit pas simplement de réserver des billets.<br/>
      Fééti a été pensé pour celles et ceux qui veulent vivre les événements autrement :
      Concerts, spectacles, festivals, conférences, événements sportifs, expériences culturelles et moments uniques.
    </p>
    <p style="color:#1f2937;font-size:15px;line-height:1.8;margin:20px 0 0;">En quelques clics, vous pouvez :</p>
    <ul style="margin:8px 0 0;padding-left:20px;color:#1f2937;font-size:15px;line-height:2;">
      <li>découvrir les meilleurs événements autour de vous,</li>
      <li>réserver votre place instantanément,</li>
      <li>accéder à vos billets depuis votre téléphone,</li>
      <li>vivre des expériences exclusives,</li>
      <li>suivre les événements qui comptent pour vous.</li>
    </ul>
    <p style="color:#1f2937;font-size:15px;line-height:1.8;margin:20px 0 32px;">
      Chaque ticket ouvre une porte, Chaque événement raconte une histoire, Et votre prochaine expérience commence maintenant.
    </p>
    <div style="text-align:center;">
      <a href="${FRONT_URL}" style="display:inline-block;background:${MINT};color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:28px;font-size:16px;font-weight:700;">
        Découvrir les événements
      </a>
    </div>
  `, { header: "celebration", footer: "subscriber", recipientEmail: data.email });
}

export function templateWelcomeOrganizer(data: { organizerName: string; email?: string; contractHtml?: string; pandadocSigningUrl?: string }): string {
  return baseLayout(`
    <div style="text-align:center;margin-bottom:8px;">
      <h1 style="margin:0;font-size:28px;font-weight:800;color:${LINK_BLUE};line-height:1.25;">Votre espace<br/>organisateur est prêt</h1>
    </div>
    <p style="color:#1f2937;font-size:15px;line-height:1.8;margin:24px 0 0;">
      Bonjour ${data.organizerName},<br/>
      Bonne nouvelle : votre compte organisateur Feeti est maintenant activé.<br/>
      Vous pouvez dès maintenant commencer à :
    </p>
    <ul style="margin:8px 0 0;padding-left:20px;color:#1f2937;font-size:15px;line-height:2;">
      <li>publier vos événements,</li>
      <li>vendre vos billets,</li>
      <li>suivre vos performances,</li>
      <li>gérer vos accès,</li>
      <li>interagir avec votre audience.</li>
    </ul>
    <p style="color:#1f2937;font-size:15px;line-height:1.8;margin:16px 0 32px;">
      Feeti vous donne les outils pour transformer chaque événement en expérience mémorable.<br/>
      Bienvenue dans une nouvelle manière d'organiser.
    </p>
    <div style="text-align:center;margin-bottom:${data.pandadocSigningUrl ? "32px" : "0"};">
      <a href="${FRONT_URL}" style="display:inline-block;background:${MINT};color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:28px;font-size:16px;font-weight:700;">
        Créer mon événement
      </a>
    </div>
    ${data.pandadocSigningUrl ? `
    <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:12px;padding:28px;text-align:center;">
      <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#92400e;">Signez votre contrat de partenariat</h3>
      <p style="margin:0 0 20px;color:#78350f;font-size:14px;line-height:1.6;">
        Pour finaliser votre partenariat avec Féeti, veuillez lire et signer le contrat ci-dessous.
        Cette étape est obligatoire pour publier vos événements.
      </p>
      <a href="${data.pandadocSigningUrl}" style="display:inline-block;background:linear-gradient(135deg,#d97706,#f59e0b);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700;">
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
  `, { header: "celebration", footer: "subscriber", recipientEmail: data.email });
}

export function templateWelcomeController(data: {
  controllerName: string;
  email: string;
  password: string;
  eventTitle: string;
  loginUrl: string;
}): string {
  return baseLayout(`
    <div style="text-align:center;margin-bottom:32px;">
      <h2 style="margin:0;font-size:24px;font-weight:700;color:#111827;">Bienvenue, ${data.controllerName} !</h2>
      <p style="margin:10px 0 0;color:#6b7280;font-size:15px;">Vous avez été assigné comme contrôleur de billets</p>
    </div>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin-bottom:24px;">
      Un compte contrôleur Féeti vient d'être créé pour vous afin de gérer l'accès à l'événement :
      <strong style="color:#111827;">${data.eventTitle}</strong>.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:24px;margin-bottom:28px;">
      <h3 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#166534;">Vos identifiants de connexion</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:14px;width:100px;">Email</td>
          <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${data.email}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:14px;">Mot de passe</td>
          <td style="padding:6px 0;">
            <span style="background:#ffffff;border:1px solid #d1fae5;border-radius:6px;padding:4px 12px;font-family:monospace;font-size:15px;font-weight:700;color:#065f46;letter-spacing:1px;">${data.password}</span>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">Conservez ces identifiants en lieu sûr. Vous pourrez modifier votre mot de passe après connexion.</p>
    </div>
    <div style="text-align:center;margin-bottom:8px;">
      <a href="${data.loginUrl}" style="display:inline-block;background:${MINT};color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:28px;font-size:16px;font-weight:600;">
        Se connecter à Féeti
      </a>
    </div>
  `, { footer: "social" });
}

export function templatePasswordChanged(data: { userName: string }): string {
  return baseLayout(`
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">Mot de passe modifié</h2>
    <p style="color:#6b7280;font-size:16px;margin-bottom:28px;">Bonjour ${data.userName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin-bottom:28px;">
      Le mot de passe de votre compte Féeti vient d'être modifié avec succès.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin-bottom:8px;">
      <p style="margin:0;color:#991b1b;font-size:14px;">
        <strong>Ce n'était pas vous ?</strong> Contactez immédiatement notre support et sécurisez votre compte.
      </p>
    </div>
  `, { footer: "social" });
}

/** Email envoyé suite à une demande de réinitialisation de mot de passe. */
export function templateResetPassword(data: { userName?: string; resetUrl: string }): string {
  return baseLayout(`
    <p style="font-size:15px;line-height:1.8;margin:0 0 20px;">Bonjour ${data.userName || "[Prénom]"},</p>
    <p style="font-size:15px;line-height:1.8;margin:0 0 20px;">
      Nous avons reçu une demande de réinitialisation du mot de passe associé à votre compte Feeti.<br/>
      Pas d'inquiétude, cela arrive.
    </p>
    <p style="font-size:15px;line-height:1.8;margin:0 0 32px;">
      Pour choisir un nouveau mot de passe et retrouver l'accès à votre compte, cliquez simplement sur le bouton ci-dessous.
    </p>
    <div style="border-top:1px solid rgba(255,255,255,0.2);margin-bottom:32px;"></div>
    <div style="text-align:center;">
      <a href="${data.resetUrl}" style="display:inline-block;background:${MINT};color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:28px;font-size:16px;font-weight:700;">
        Réinitialiser Ici
      </a>
    </div>
  `, { header: "security-dark", footer: "social", heroTitle: "Réinitialisez votre<br/>mot de passe" });
}

/** Email de code de vérification (OTP) pour confirmer l'accès à un compte. */
export function templateVerificationCode(data: { code: string; validityMinutes?: number }): string {
  return baseLayout(`
    <div style="text-align:center;margin:12px 0 28px;">
      <span style="display:inline-block;background:#ffffff;border:2px solid ${NAVY};border-radius:10px;padding:16px 32px;font-size:32px;font-weight:800;letter-spacing:8px;color:${NAVY};">${data.code}</span>
    </div>
    <p style="font-size:15px;line-height:1.8;margin:0 0 8px;text-align:center;">
      Ce code est valable pendant ${data.validityMinutes || 10} minutes.<br/>
      Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.<br/>
      Chez Feeti, la sécurité de votre compte et de vos billets est une priorité.
    </p>
  `, { header: "security-light", footer: "social", heroTitle: "Confirmez votre accès" });
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
  `, { footer: "social" });
}

export function templateEventApproved(data: { organizerName: string; eventTitle: string; eventDate: string; dashboardUrl: string }): string {
  return baseLayout(`
    <div style="text-align:center;margin-bottom:32px;">
      ${statusBadge("success")}
      <h2 style="margin:0;font-size:24px;font-weight:700;color:#111827;">Votre événement est publié !</h2>
      <p style="margin:10px 0 0;color:#6b7280;font-size:16px;">Bonjour ${data.organizerName},</p>
    </div>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin-bottom:24px;">
      Bonne nouvelle ! Votre événement <strong>${data.eventTitle}</strong> prévu le <strong>${data.eventDate}</strong>
      vient d'être approuvé par notre équipe. Il est maintenant visible par le public sur Féeti et les billets sont disponibles à la vente.
    </p>
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${data.dashboardUrl}" style="display:inline-block;background:${MINT};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:28px;font-size:16px;font-weight:700;">
        Voir mon tableau de bord
      </a>
    </div>
  `, { footer: "social" });
}

export function templateEventRejected(data: { organizerName: string; eventTitle: string; rejectionReason: string; dashboardUrl: string }): string {
  return baseLayout(`
    <div style="text-align:center;margin-bottom:32px;">
      ${statusBadge("error")}
      <h2 style="margin:0;font-size:24px;font-weight:700;color:#111827;">Événement non approuvé</h2>
      <p style="margin:10px 0 0;color:#6b7280;font-size:16px;">Bonjour ${data.organizerName},</p>
    </div>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin-bottom:24px;">
      Après examen, votre événement <strong>${data.eventTitle}</strong> n'a pas pu être approuvé pour la raison suivante :
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:20px;margin-bottom:28px;">
      <p style="margin:0;color:#991b1b;font-size:15px;line-height:1.6;">${data.rejectionReason}</p>
    </div>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin-bottom:24px;">
      Vous pouvez corriger votre événement depuis votre tableau de bord et le soumettre à nouveau.
    </p>
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${data.dashboardUrl}" style="display:inline-block;background:${MINT};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:28px;font-size:16px;font-weight:700;">
        Modifier mon événement
      </a>
    </div>
  `, { footer: "social" });
}

// ─── Newsletter hebdomadaire "Les Fééties de la semaine" ───────────────
//
// Reproduction fidèle de la maquette fournie (mail test.png) :
//  - Les illustrations non reproductibles en HTML (logo + lunettes + titre
//    bulle, photo héro, collage produits) sont des images statiques hébergées
//    sur le front (front/public/email/*.jpg), au même titre que le logo.
//  - Le contenu variable (événements, replay, date) est du HTML/CSS réel,
//    calé sur les couleurs et dimensions relevées sur la maquette, afin de
//    rester exact chaque semaine (mois/année, événements, etc.).

function formatDigestDate(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  } catch {
    return iso;
  }
}

function digestCard(e: DigestEventCard, width: number, height: number, basePath: "events" | "streaming"): string {
  const safeTitle = e.title.replace(/"/g, "&quot;");
  return `
    <td width="${width}" valign="top" style="padding:0 6px 12px;">
      <a href="${FRONT_URL}/${basePath}/${e.id}" style="text-decoration:none;">
        <div style="position:relative;line-height:0;border-radius:14px;overflow:hidden;background:#e5e7eb;">
          <img src="${e.image}" width="${width}" alt="${safeTitle}" style="display:block;width:100%;height:${height}px;object-fit:cover;"/>
          <div style="position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:rgba(17,17,17,0.35);text-align:center;line-height:26px;color:#ffffff;font-size:13px;">&#9825;</div>
        </div>
      </a>
    </td>`;
}

function digestCardGrid(cards: DigestEventCard[], perRow: number, width: number, height: number, basePath: "events" | "streaming"): string {
  let rows = "";
  for (let i = 0; i < cards.length; i += perRow) {
    rows += `<tr>${cards.slice(i, i + perRow).map((c) => digestCard(c, width, height, basePath)).join("")}</tr>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows}</table>`;
}

/** Ligne "réseaux sociaux" thème digest (cercles contour teal, fond sombre). */
function digestSocialIconsRow(): string {
  const icon = (glyph: string, fontFamily = "Arial, sans-serif") => `
    <td style="padding:0 6px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="42" height="42" align="center" valign="middle" style="border:1px solid rgba(22,189,160,0.4);border-radius:50%;font:700 15px ${fontFamily};color:${DIGEST_TEAL};line-height:1;">${glyph}</td>
      </tr></table>
    </td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
    ${icon("f", "Georgia, 'Times New Roman', serif")}
    ${icon("G+")}
    ${icon("IG")}
    ${icon("&#9654;")}
  </tr></table>`;
}

export function templateWeeklyDigest(data: {
  content: WeeklyDigestContent;
  recipientEmail: string;
  unsubscribeUrl: string;
}): string {
  const { content, recipientEmail, unsubscribeUrl } = data;

  // ── Bandeau héro : logo/titre statiques + photo statique + date/top events dynamiques ──
  const topEventsRow = content.topEvents.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        ${content.topEvents.map((e) => digestCard(e, 131, 164, "events")).join("")}
      </tr></table>`
    : "";

  const heroSection = `
  <tr><td style="background:${DIGEST_CREAM};padding:0;">
    <img src="${DIGEST_HEADER_HERO_URL}" width="600" alt="Féeti — Les Fééties de la semaine" style="display:block;width:100%;height:auto;"/>
  </td></tr>
  <tr><td style="background:${DIGEST_CREAM};padding:0;">
    <img src="${DIGEST_HERO_PHOTO_URL}" width="600" alt="Nos meilleures recommandations" style="display:block;width:100%;height:auto;"/>
  </td></tr>
  <tr><td style="background:#000000;padding:18px 20px 20px;">
    <p style="margin:0 0 16px;font:700 20px Arial, sans-serif;color:#ffffff;">
      <span style="color:#53e88c;">${content.monthLabel}</span>
      <span style="color:#ffffff;opacity:0.5;"> | </span>
      <span style="color:#ffffff;">${content.yearLabel}</span>
    </p>
    ${topEventsRow}
  </td></tr>`;

  // ── "À ne pas rater" ──
  const mustSeeSection = content.mustSee.length
    ? `
  <tr><td style="background:${DIGEST_CREAM};padding:32px 20px 8px;">
    <p style="margin:0 0 20px;font:800 30px Arial, sans-serif;color:#000000;">A NE PAS RATER</p>
    ${digestCardGrid(content.mustSee, 3, 178, 220, "events")}
  </td></tr>
  <tr><td style="background:${DIGEST_CREAM};padding:8px 20px 32px;text-align:center;">
    <a href="${FRONT_URL}/events" style="display:inline-block;background:${DIGEST_NAVY_BTN};color:#ffffff;text-decoration:none;padding:16px 40px;font:700 17px Arial, sans-serif;">
      &#127915; Voir les évènement
    </a>
  </td></tr>`
    : "";

  // ── Bon plans ──
  const bonPlanSection = `
  <tr><td style="background:${DIGEST_CREAM};padding:0 20px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
      <td width="300" valign="top" style="background:${DIGEST_LIME};border-radius:16px;padding:28px 24px;">
        <p style="margin:0 0 4px;font:600 20px Arial, sans-serif;color:${DIGEST_TEAL};">Consulter tous les</p>
        <p style="margin:0 0 24px;font:800 34px Arial, sans-serif;color:${DIGEST_TEAL};">BON-PLANS.</p>
        <a href="${FRONT_URL}/deals" style="display:inline-block;background:${DIGEST_RED};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:24px;font:700 16px Arial, sans-serif;">Voir +</a>
      </td>
      <td width="12"></td>
      <td width="248" valign="top" style="border-radius:16px;overflow:hidden;line-height:0;">
        <img src="${DIGEST_BONPLAN_PHOTO_URL}" width="248" alt="Bons plans Féeti" style="display:block;width:100%;height:auto;border-radius:16px;"/>
      </td>
    </tr></table>
  </td></tr>`;

  // ── Replay (uniquement si un événement avec vidéo est disponible) ──
  const replaySection = content.replay
    ? `
  <tr><td style="background:${DIGEST_CREAM};padding:0 20px 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-radius:16px;overflow:hidden;background:${DIGEST_DARK};background-image:url('${content.replay.image}');background-size:cover;background-position:center;">
      <tr><td style="padding:32px 24px;background:linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.15) 100%);">
        <p style="margin:0 0 10px;font:400 26px Arial, sans-serif;color:#ffffff;">Disponible en <strong>Replay</strong> actuellement !</p>
        <p style="margin:0 0 10px;font:400 16px Arial, sans-serif;color:#ffffff;">${content.replay.title.toUpperCase()} | ${formatDigestDate(content.replay.date)} |</p>
        <p style="margin:0 0 20px;font:400 14px Arial, sans-serif;color:${DIGEST_TEAL};">&#128205; ${content.replay.location}</p>
        <a href="${FRONT_URL}/events" style="display:inline-block;background:#ffffff;color:#111827;text-decoration:none;padding:12px 24px;font:700 14px Arial, sans-serif;">Voir la vidéo &#9654;</a>
      </td></tr>
    </table>
  </td></tr>`
    : "";

  // ── En live streaming ──
  const liveSection = content.liveEvents.length
    ? `
  <tr><td style="background:${DIGEST_DARK};padding:32px 20px 8px;">
    <p style="margin:0 0 20px;font:800 30px Arial, sans-serif;color:#ffffff;">EN LIVE STREAMING</p>
    ${digestCardGrid(content.liveEvents, 3, 178, 220, "streaming")}
  </td></tr>
  <tr><td style="background:${DIGEST_DARK};padding:8px 20px 32px;text-align:center;">
    <a href="${FRONT_URL}/live" style="display:inline-block;background:${DIGEST_RED};color:#ffffff;text-decoration:none;padding:16px 40px;font:700 17px Arial, sans-serif;width:100%;box-sizing:border-box;">
      &#127915; Voir les évènement
    </a>
  </td></tr>`
    : "";

  // ── Footer ──
  const storeBtn = (label: string, sub: string, href: string) => `
    <a href="${href}" style="display:inline-block;border:1px solid rgba(255,255,255,0.6);border-radius:8px;padding:8px 16px;text-decoration:none;margin-left:8px;">
      <span style="display:block;font:400 9px Arial, sans-serif;color:#ffffff;opacity:0.8;">${label}</span>
      <span style="display:block;font:700 15px Arial, sans-serif;color:#ffffff;">${sub}</span>
    </a>`;

  const footerSection = `
  <tr><td style="background:${DIGEST_FOOTER_NAVY};padding:40px 20px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${DIGEST_TEAL};border-radius:16px;">
      <tr>
        <td style="padding:28px 24px;" valign="middle">
          <p style="margin:0 0 8px;font:600 20px Arial, sans-serif;color:#ffffff;">Pour plus de possibilité ?</p>
          <p style="margin:0;font:400 14px Arial, sans-serif;color:#ffffff;opacity:0.9;">Téléchargez votre application dès maintenant via le store de votre choix.</p>
        </td>
        <td align="right" style="padding:28px 24px;white-space:nowrap;" valign="middle">
          ${storeBtn("Download on the", "App Store", "https://apps.apple.com")}
          ${storeBtn("GET IT ON", "Google Play", "https://play.google.com")}
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="background:${DIGEST_FOOTER_NAVY};padding:28px 20px 0;text-align:center;">
    <p style="margin:0;font:400 13px Arial, sans-serif;color:${DIGEST_FOOTER_MUTED};line-height:1.7;">
      © ${new Date().getFullYear()} Féeti.io, propulsé par Eroïste. Tous droits réservés.<br/>
      Vous recevez cet email car vous êtes inscrit(e) à la newsletter Féeti.
    </p>
  </td></tr>
  <tr><td style="background:${DIGEST_FOOTER_NAVY};padding:20px 40px 0;">
    <div style="border-top:1px solid rgba(22,189,160,0.35);"></div>
  </td></tr>
  <tr><td style="background:${DIGEST_FOOTER_NAVY};padding:24px 20px 0;text-align:center;">
    <p style="margin:0;font:400 13px Arial, sans-serif;color:${DIGEST_FOOTER_MUTED};line-height:1.9;">
      <em style="font-weight:700;">Notre adresse :</em><br/>
      Féeti.io<br/>
      Brazzaville, Congo<br/>
      contact@feeti.io<br/>
      <a href="${unsubscribeUrl}" style="color:${DIGEST_FOOTER_MUTED};text-decoration:underline;">Se désinscrire</a>
    </p>
  </td></tr>
  <tr><td style="background:${DIGEST_FOOTER_NAVY};padding:28px 20px;text-align:center;">
    ${digestSocialIconsRow()}
  </td></tr>
  <tr><td style="background:${DIGEST_FOOTER_NAVY};padding:0 20px 32px;text-align:center;">
    <p style="margin:0;font:400 13px Arial, sans-serif;color:${DIGEST_FOOTER_MUTED};">
      <a href="${FRONT_URL}/legal/terms" style="color:${DIGEST_FOOTER_MUTED};text-decoration:none;">Termes &amp; Conditions</a>
      &nbsp;&nbsp;&nbsp;
      <a href="${FRONT_URL}/legal/faq" style="color:${DIGEST_FOOTER_MUTED};text-decoration:none;">Besoin d'aide ?</a>
      &nbsp;&nbsp;&nbsp;
      <a href="${FRONT_URL}/organizer" style="color:${DIGEST_FOOTER_MUTED};text-decoration:none;">Poster un évenement</a>
    </p>
  </td></tr>`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Les Fééties de la semaine</title>
</head>
<body style="margin:0;padding:0;background:${DIGEST_CREAM};font-family:Arial, sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">Le top des événements, les bons plans et le live streaming de la semaine sur Féeti.</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${DIGEST_CREAM};">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
        ${heroSection}
        ${mustSeeSection}
        ${bonPlanSection}
        ${replaySection}
        ${liveSection}
        ${footerSection}
      </table>
    </td></tr>
  </table>
  <!-- destinataire : ${recipientEmail} -->
</body>
</html>`;
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
      html: templateWelcomeUser({ ...data, email: data.email || to }),
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
      html: templateWelcomeOrganizer({ ...data, email: data.email || to }),
      text: `Bienvenue ${data.organizerName} ! Votre compte organisateur Féeti a été créé.${signingText}`,
    });
  }

  async sendWelcomeController(to: string, data: Parameters<typeof templateWelcomeController>[0]): Promise<void> {
    await this.provider.send({
      to,
      subject: `Vos identifiants contrôleur Féeti — ${data.eventTitle}`,
      html: templateWelcomeController(data),
      text: `Bonjour ${data.controllerName}, voici vos identifiants : email: ${data.email} / mot de passe: ${data.password}. Connectez-vous sur ${data.loginUrl}`,
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

  /** Non branché à une route pour le moment (le reset est aujourd'hui géré par Firebase côté front). */
  async sendResetPassword(to: string, data: Parameters<typeof templateResetPassword>[0]): Promise<void> {
    await this.provider.send({
      to,
      subject: "Réinitialisez votre mot de passe Féeti",
      html: templateResetPassword(data),
      text: `Réinitialisez votre mot de passe Féeti ici : ${data.resetUrl}`,
    });
  }

  /** Non branché à une route pour le moment (aucun flux OTP en place côté back). */
  async sendVerificationCode(to: string, data: Parameters<typeof templateVerificationCode>[0]): Promise<void> {
    await this.provider.send({
      to,
      subject: `${data.code} — Votre code de vérification Féeti`,
      html: templateVerificationCode(data),
      text: `Votre code de vérification Féeti : ${data.code} (valable ${data.validityMinutes || 10} minutes).`,
    });
  }

  async sendEventApproved(to: string, data: Parameters<typeof templateEventApproved>[0]): Promise<void> {
    await this.provider.send({
      to,
      subject: `✅ Votre événement "${data.eventTitle}" a été approuvé !`,
      html: templateEventApproved(data),
      text: `Bonjour ${data.organizerName}, votre événement "${data.eventTitle}" a été approuvé et est maintenant visible sur Féeti.`,
    });
  }

  async sendEventRejected(to: string, data: Parameters<typeof templateEventRejected>[0]): Promise<void> {
    await this.provider.send({
      to,
      subject: `❌ Votre événement "${data.eventTitle}" n'a pas été approuvé`,
      html: templateEventRejected(data),
      text: `Bonjour ${data.organizerName}, votre événement "${data.eventTitle}" n'a pas été approuvé. Raison : ${data.rejectionReason}`,
    });
  }

  /** Newsletter hebdomadaire "Les Fééties de la semaine". */
  async sendWeeklyDigest(
    to: string,
    data: { content: WeeklyDigestContent; unsubscribeUrl: string }
  ): Promise<void> {
    await this.provider.send({
      to,
      subject: `✨ Les Fééties de la semaine — ${data.content.monthLabel} ${data.content.yearLabel}`,
      html: templateWeeklyDigest({ content: data.content, recipientEmail: to, unsubscribeUrl: data.unsubscribeUrl }),
      text: `Découvrez le top des événements, les bons plans et le live streaming de la semaine sur Féeti : ${FRONT_URL}`,
    });
  }

  // Méthode générique pour extensions futures
  async send(to: string, subject: string, html: string): Promise<void> {
    await this.provider.send({ to, subject, html });
  }
}

export const emailService = new EmailService();
