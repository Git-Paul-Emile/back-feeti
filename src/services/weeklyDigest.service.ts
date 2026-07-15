/**
 * ═══════════════════════════════════════════════════════════════════════
 *  CAMPAGNE "LES FÉÉTIES DE LA SEMAINE" — audience + contenu
 * ═══════════════════════════════════════════════════════════════════════
 * Audience : union de 3 sources, dédupliquée par email (décision produit) :
 *   1) Inscrits au formulaire newsletter du footer (NewsletterSubscriber actifs)
 *   2) Tous les utilisateurs enregistrés sur le site (User)
 *   3) Toute personne ayant déjà effectué un achat (email du porteur de billet)
 *
 * Contenu : requêtes non personnalisées (même contenu pour tous les
 * destinataires, comme dans la maquette de référence) — cinq sections :
 *   - LE TOP DES ÉVÉNEMENTS PRÈS DE CHEZ VOUS (mis en avant par promotion)
 *   - À NE PAS RATER (grille des prochains événements)
 *   - BON-PLANS (compteur de deals actifs, lien vers /deals)
 *   - DISPONIBLE EN REPLAY (dernier événement avec vidéo disponible)
 *   - EN LIVE STREAMING (événements STREAMING_LIVE / MIXTE à venir)
 */

import { prisma } from "../config/database.js";
import { newsletterRepository } from "../repositories/newsletter.repository.js";

const PROMO_RANK: Record<string, number> = { OR: 4, ARGENT: 3, BRONZE: 2, LITE: 1 };

interface PromotableEvent {
  promotionStatus?: string | null;
  promotionType?: string | null;
  promotionStartDate?: Date | null;
  promotionEndDate?: Date | null;
}

function promoRank(e: PromotableEvent): number {
  const now = new Date();
  const isActive =
    e.promotionStatus === "active" &&
    !!e.promotionType &&
    (!e.promotionStartDate || e.promotionStartDate <= now) &&
    (!e.promotionEndDate || e.promotionEndDate >= now);
  return isActive ? (PROMO_RANK[e.promotionType!] ?? 0) : 0;
}

export interface DigestEventCard {
  id: string;
  title: string;
  image: string;
  date: string;
  time: string;
  location: string;
  category: string;
}

export interface WeeklyDigestContent {
  monthLabel: string;
  yearLabel: string;
  topEvents: DigestEventCard[];
  mustSee: DigestEventCard[];
  liveEvents: DigestEventCard[];
  replay: { title: string; date: string; location: string; image: string } | null;
  dealsCount: number;
}

function toCard(e: {
  id: string; title: string; image: string; date: string; time: string; location: string; category: string;
}): DigestEventCard {
  return { id: e.id, title: e.title, image: e.image, date: e.date, time: e.time, location: e.location, category: e.category };
}

export interface DigestRecipient {
  email: string;
  unsubscribeToken: string;
}

export const weeklyDigestService = {
  /**
   * Audience = union dédupliquée de 3 sources (décision produit validée) :
   *   1) NewsletterSubscriber actifs (formulaire du footer)
   *   2) Tous les User (utilisateurs enregistrés)
   *   3) Tout email porteur d'un billet (achat), même sans compte
   *
   * Chaque email de l'audience doit avoir une ligne NewsletterSubscriber pour
   * disposer d'un lien de désinscription individuel. On crée donc les lignes
   * manquantes (source "auto"), mais on ne touche JAMAIS aux lignes déjà
   * existantes : un email déjà désinscrit (isActive=false) doit le rester,
   * même s'il correspond toujours à un User ou à un acheteur.
   */
  async resolveAudience(): Promise<DigestRecipient[]> {
    const [newsletterEmails, users, ticketHolders] = await Promise.all([
      newsletterRepository.findAllActiveEmails(),
      prisma.user.findMany({ select: { email: true } }),
      prisma.ticket.findMany({ select: { holderEmail: true }, distinct: ["holderEmail"] }),
    ]);

    const unionEmails = new Set<string>();
    for (const e of newsletterEmails) unionEmails.add(e.trim().toLowerCase());
    for (const u of users) unionEmails.add(u.email.trim().toLowerCase());
    for (const t of ticketHolders) if (t.holderEmail) unionEmails.add(t.holderEmail.trim().toLowerCase());

    const existing = await prisma.newsletterSubscriber.findMany({
      where: { email: { in: Array.from(unionEmails) } },
      select: { email: true },
    });
    const existingEmails = new Set(existing.map((e) => e.email));
    const toCreate = Array.from(unionEmails).filter((e) => !existingEmails.has(e));

    if (toCreate.length > 0) {
      await prisma.newsletterSubscriber.createMany({
        data: toCreate.map((email) => ({ email, source: "auto" })),
        skipDuplicates: true,
      });
    }

    return prisma.newsletterSubscriber.findMany({
      where: { email: { in: Array.from(unionEmails) }, isActive: true },
      select: { email: true, unsubscribeToken: true },
    });
  },

  async buildContent(): Promise<WeeklyDigestContent> {
    const todayISO = new Date().toISOString().slice(0, 10);
    const baseWhere = { status: "published", isPrivateForBadges: false, date: { gte: todayISO } } as const;

    const [upcoming, liveRaw, replayRaw, dealsCount] = await Promise.all([
      prisma.event.findMany({ where: baseWhere, orderBy: { date: "asc" }, take: 40 }),
      prisma.event.findMany({
        where: { ...baseWhere, eventType: { in: ["STREAMING_LIVE", "MIXTE"] } },
        orderBy: { date: "asc" },
        take: 6,
      }),
      prisma.event.findFirst({
        where: { videoUrl: { not: null }, status: "published" },
        orderBy: { date: "desc" },
      }),
      prisma.deal.count({ where: { status: "published", validUntil: { gte: todayISO } } }),
    ]);

    const sorted = [...upcoming].sort(
      (a, b) => promoRank(b) - promoRank(a) || a.date.localeCompare(b.date)
    );

    const topEvents = sorted.slice(0, 4).map(toCard);
    const usedIds = new Set(topEvents.map((e) => e.id));
    const mustSee = sorted.filter((e) => !usedIds.has(e.id)).slice(0, 6).map(toCard);

    const now = new Date();
    const monthLabel = now
      .toLocaleDateString("fr-FR", { month: "long", timeZone: "Africa/Brazzaville" })
      .toUpperCase();
    const yearLabel = String(now.getFullYear());

    return {
      monthLabel,
      yearLabel,
      topEvents,
      mustSee,
      liveEvents: liveRaw.map(toCard),
      replay: replayRaw
        ? { title: replayRaw.title, date: replayRaw.date, location: replayRaw.location, image: replayRaw.image }
        : null,
      dealsCount,
    };
  },
};
