import { createCanvas, loadImage } from "@napi-rs/canvas";
import QRCode from "qrcode";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const W = 1659;
const H = 704;

// Le SVG est un simple wrapper autour d'une image JPEG base64 (aucun élément vectoriel).
// On extrait ce JPEG une seule fois au chargement du module.
function loadTemplateJpeg(): Buffer {
  const svgPath = join(__dirname, "../assets/ticket-template.svg");
  const svg = readFileSync(svgPath, "utf8");
  const m = svg.match(/xlink:href="data:image\/jpeg;base64,([^"]+)"/);
  if (!m) throw new Error("Template JPEG introuvable dans le SVG");
  return Buffer.from(m[1], "base64");
}

const TEMPLATE_JPEG = loadTemplateJpeg();

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function formatPrice(price: number, currency: string): string {
  if (currency === "FCFA") return new Intl.NumberFormat("fr-FR").format(price) + " FCFA";
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

export interface TicketCanvasData {
  id: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  eventImage?: string;
  category: string;
  price: number;
  currency: string;
  holderName: string;
  holderEmail: string;
  qrData: string;
}

export async function buildTicketJpegBuffer(ticket: TicketCanvasData): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 1. Fond : JPEG extrait du template SVG
  const bg = await loadImage(TEMPLATE_JPEG);
  ctx.drawImage(bg, 0, 0, W, H);

  const txt = (
    text: string, x: number, y: number,
    font: string, color = "#1a1a2e", align: "left" | "center" | "right" = "left",
  ) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  };

  const shortId = ticket.id.slice(-8).toUpperCase();

  // 2. Image événement (cadre x=83 y=103 w=393 h=489, réduit de 65px)
  if (ticket.eventImage) {
    try {
      const evImg = await loadImage(ticket.eventImage);
      const fw = 393 - 65;
      const fh = 489 - 65;
      const imgX = 83 + Math.round((393 - fw) / 2);
      const imgY = 103 + Math.round((489 - fh) / 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(imgX, imgY, fw, fh);
      ctx.clip();
      const ratio = Math.max(fw / evImg.width, fh / evImg.height);
      const dw = evImg.width * ratio;
      const dh = evImg.height * ratio;
      ctx.drawImage(evImg, imgX + (fw - dw) / 2, imgY + (fh - dh) / 2, dw, dh);
      ctx.restore();
    } catch { /* image non accessible */ }
  }

  // 3. Titre
  ctx.font = "bold 30px Arial";
  ctx.fillStyle = "#1a1a2e";
  ctx.textAlign = "center";
  let title = ticket.eventTitle;
  while (ctx.measureText(title).width > 700 && title.length > 5) title = title.slice(0, -1);
  if (title !== ticket.eventTitle) title += "…";
  ctx.fillText(title, 795, 175);

  // Catégorie et N° billet
  txt(ticket.category, 718, 213, "17px Arial", "#1a1a2e", "left");
  txt(shortId, 965, 213, "17px Arial", "#4a3a6e", "left");

  // Date
  txt(formatDate(ticket.eventDate), 503, 337, "bold 15px Arial");

  // Heure
  txt(ticket.eventTime, 820, 337, "bold 21px Arial");

  // Lieu (tronqué si trop long)
  ctx.font = "bold 15px Arial";
  ctx.fillStyle = "#1a1a2e";
  ctx.textAlign = "left";
  let loc = ticket.eventLocation;
  while (ctx.measureText(loc).width > 270 && loc.length > 4) loc = loc.slice(0, -1);
  if (loc !== ticket.eventLocation) loc += "…";
  ctx.fillText(loc, 503, 404);

  // Prix
  txt(formatPrice(ticket.price, ticket.currency), 820, 404, "bold 17px Arial", "#cc0055");

  // Porteur (tronqué si trop long)
  ctx.font = "bold 17px Arial";
  ctx.fillStyle = "#1a1a2e";
  ctx.textAlign = "left";
  let holder = ticket.holderName;
  while (ctx.measureText(holder).width > 660 && holder.length > 4) holder = holder.slice(0, -1);
  if (holder !== ticket.holderName) holder += "…";
  ctx.fillText(holder, 503, 467);

  // Email
  txt(ticket.holderEmail, 503, 530, "14px Arial");

  // N° en bas (3 positions)
  txt(shortId, 205, 621, "bold 12px Arial", "#555566", "left");
  txt(shortId, 750, 621, "bold 12px Arial", "#555566", "left");
  txt(shortId, 1335, 621, "bold 12px Arial", "#555566", "left");

  // 4. QR code (cadre x=1241 y=185 w=340 h=384, QR réduit de 65px)
  const qrSize = 337 - 65; // 272
  const qrX = 1220 + Math.round((340 - qrSize) / 2);
  const qrY = 185 + Math.round((384 - qrSize) / 2);
  const qrPngBuffer = await QRCode.toBuffer(ticket.qrData, { width: qrSize, margin: 1 });
  const qrImg = await loadImage(qrPngBuffer);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  return canvas.encode("jpeg", 95);
}
