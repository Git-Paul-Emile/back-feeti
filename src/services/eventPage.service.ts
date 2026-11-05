import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/database.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import {
  baseSlugFromTitle,
  normalizeSlugInput,
  validateSlug,
  withNumericSuffix,
} from "../utils/slug.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const ROOT_DOMAIN = () => process.env.EVENT_PAGES_ROOT_DOMAIN || "feeti.io";
/** Modèle d'URL publique ; en local : http://{slug}.localhost:3100 */
const PAGE_URL_TEMPLATE = () => process.env.EVENT_PAGES_URL_TEMPLATE || `https://{slug}.${ROOT_DOMAIN()}`;
const STORE_URL = () => (process.env.FRONT_URL || "https://feeti.io").replace(/\/$/, "");
const PLAY_URL = () => (process.env.FEETIPLAY_URL || "").replace(/\/$/, "");
/** Décalage horaire des champs Event.date/time (saisis en heure locale). */
const EVENT_TZ_OFFSET = () => process.env.EVENT_TIMEZONE_OFFSET || "+01:00";
const SLUG_REDIRECT_MONTHS = 12;
const LOW_STOCK_THRESHOLD = 20;
const PREVIEW_TOKEN_TTL = "24h";
const PREVIEW_PURPOSE = "event-page-preview";
const MAX_SUFFIX_ATTEMPTS = 50;

const ADMIN_ROLES = new Set(["admin", "super_admin"]);
/** Statuts d'événement qui rendent la page définitivement indisponible (410). */
const GONE_EVENT_STATUSES = new Set(["rejected", "cancelled"]);
const ORGANIZER_STATUSES = ["draft", "published", "paused"] as const;
type OrganizerStatus = (typeof ORGANIZER_STATUSES)[number];

function previewSecret(): string {
  const secret = process.env.EVENT_PAGE_PREVIEW_SECRET || process.env.ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error("EVENT_PAGE_PREVIEW_SECRET ou ACCESS_TOKEN_SECRET requis");
  return secret;
}

export function buildPageUrl(slug: string): string {
  return PAGE_URL_TEMPLATE().replace("{slug}", slug);
}

// ─── Billets (Event.ticketTypes est une chaîne JSON [{ type, price }]) ───────

export type PublicTicketType = { id: string; name: string; price: number };

export function parseTicketTypes(event: { ticketTypes: string | null; price: number; vipPrice: number | null }): PublicTicketType[] {
  let parsed: unknown = [];
  if (event.ticketTypes) {
    try {
      parsed = JSON.parse(event.ticketTypes);
    } catch {
      parsed = [];
    }
  }
  const list = Array.isArray(parsed)
    ? parsed
        .filter((t): t is { type: string; price?: number } => !!t && typeof t.type === "string" && t.type.trim() !== "")
        .map((t) => ({ id: t.type, name: t.type, price: Number(t.price ?? 0) }))
        .filter((t) => Number.isFinite(t.price) && t.price >= 0)
    : [];
  if (list.length > 0) return list;

  // Événements anciens sans ticketTypes : on reconstruit à partir de price / vipPrice
  const fallback: PublicTicketType[] = [{ id: "Standard", name: "Standard", price: event.price ?? 0 }];
  if (event.vipPrice != null) fallback.push({ id: "VIP", name: "VIP", price: event.vipPrice });
  return fallback;
}

function startsAtIso(date: string, time: string): string | null {
  const d = new Date(`${date}T${time || "00:00"}:00${EVENT_TZ_OFFSET()}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ─── Slugs ───────────────────────────────────────────────────────────────────

type Db = Pick<typeof prisma, "eventPage" | "eventPageSlugHistory">;

/** Un slug est libre s'il n'est ni actif sur une autre page, ni réservé par l'historique d'une autre page. */
async function isSlugFree(slug: string, db: Db, ownPageId?: string): Promise<boolean> {
  const [page, history] = await Promise.all([
    db.eventPage.findUnique({ where: { slug }, select: { id: true } }),
    db.eventPageSlugHistory.findUnique({ where: { slugOld: slug }, select: { eventPageId: true, createdAt: true } }),
  ]);
  if (page && page.id !== ownPageId) return false;
  if (history && history.eventPageId !== ownPageId && !isHistoryExpired(history.createdAt)) return false;
  return true;
}

function isHistoryExpired(createdAt: Date): boolean {
  const limit = new Date();
  limit.setMonth(limit.getMonth() - SLUG_REDIRECT_MONTHS);
  return createdAt < limit;
}

export async function generateUniqueSlug(title: string, db: Db = prisma): Promise<string> {
  const base = baseSlugFromTitle(title);
  if (await isSlugFree(base, db)) return base;
  for (let n = 2; n < MAX_SUFFIX_ATTEMPTS; n++) {
    const candidate = withNumericSuffix(base, n);
    if (await isSlugFree(candidate, db)) return candidate;
  }
  // Cas extrême : suffixe aléatoire
  return withNumericSuffix(base, Math.floor(1000 + Math.random() * 9000));
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

// ─── Contrôle d'accès ────────────────────────────────────────────────────────

type Actor = { userId: string; role: string };

async function loadOwnedEvent(eventId: string, actor: Actor) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("Événement introuvable", StatusCodes.NOT_FOUND);
  if (!ADMIN_ROLES.has(actor.role) && event.organizerId !== actor.userId) {
    throw new AppError("Accès refusé", StatusCodes.FORBIDDEN);
  }
  return event;
}

type EventRow = NonNullable<Awaited<ReturnType<typeof prisma.event.findUnique>>>;

/** Conditions de publication (dossier §4) ; renvoie la liste des manques. */
export function publicationBlockers(event: EventRow, heroImageUrl?: string | null): string[] {
  const missing: string[] = [];
  if (!event.title?.trim()) missing.push("titre");
  if (!event.date?.trim()) missing.push("date");
  if (!event.location?.trim()) missing.push("lieu");
  if (!(heroImageUrl || event.image)?.trim()) missing.push("visuel principal");
  if (parseTicketTypes(event).length === 0) missing.push("au moins un billet");
  if (event.status !== "published") missing.push("validation de l'événement par Fééti");
  return missing;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const eventPageService = {
  /**
   * Crée la page (draft) d'un événement si elle n'existe pas. Idempotent ;
   * réessaie en cas de collision de slug concurrente.
   */
  async ensurePageForEvent(eventId: string, title: string) {
    const existing = await prisma.eventPage.findUnique({ where: { eventId } });
    if (existing) return existing;
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = await generateUniqueSlug(title);
      try {
        return await prisma.eventPage.create({ data: { eventId, slug } });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        const raced = await prisma.eventPage.findUnique({ where: { eventId } });
        if (raced) return raced;
      }
    }
    throw new AppError("Impossible de générer un lien unique pour cet événement", StatusCodes.CONFLICT);
  },

  /** Variante non bloquante pour la création d'événement. */
  async ensurePageForEventSafe(eventId: string, title: string) {
    try {
      return await this.ensurePageForEvent(eventId, title);
    } catch (err) {
      logger.error(`[eventPage] création de page échouée pour l'événement ${eventId}:`, err);
      return null;
    }
  },

  async checkSlugAvailability(rawSlug: string, actor?: Actor, eventId?: string) {
    const slug = normalizeSlugInput(rawSlug);
    const validation = validateSlug(slug);
    if (!validation.valid) return { slug, available: false, reason: validation.reason };

    let ownPageId: string | undefined;
    if (eventId && actor) {
      await loadOwnedEvent(eventId, actor);
      ownPageId = (await prisma.eventPage.findUnique({ where: { eventId }, select: { id: true } }))?.id;
    }
    const free = await isSlugFree(slug, prisma, ownPageId);
    return free
      ? { slug, available: true, url: buildPageUrl(slug) }
      : { slug, available: false, reason: "Ce lien est déjà utilisé" };
  },

  async getForOrganizer(eventId: string, actor: Actor) {
    const event = await loadOwnedEvent(eventId, actor);
    const page = await this.ensurePageForEvent(event.id, event.title);
    return this.toOrganizerView(page, event);
  },

  async updateForOrganizer(
    eventId: string,
    actor: Actor,
    input: {
      slug?: string;
      status?: OrganizerStatus;
      showOnMainSite?: boolean;
      ctaLabel?: string | null;
      seoTitle?: string | null;
      seoDescription?: string | null;
    },
  ) {
    const event = await loadOwnedEvent(eventId, actor);
    const page = await this.ensurePageForEvent(event.id, event.title);
    if (page.status === "archived" && !ADMIN_ROLES.has(actor.role)) {
      throw new AppError("Cette page est archivée", StatusCodes.CONFLICT);
    }

    const data: Record<string, unknown> = {};
    if (input.showOnMainSite !== undefined) data.showOnMainSite = input.showOnMainSite;
    if (input.ctaLabel !== undefined) data.ctaLabel = input.ctaLabel?.trim() || null;
    if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle?.trim() || null;
    if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription?.trim() || null;

    if (input.status !== undefined && input.status !== page.status) {
      if (input.status === "published" || input.status === "paused") {
        const blockers = publicationBlockers(event, page.heroImageUrl);
        if (blockers.length > 0) {
          throw new AppError(
            `Publication impossible, éléments manquants : ${blockers.join(", ")}`,
            StatusCodes.UNPROCESSABLE_ENTITY,
            { status: blockers.join(", ") },
          );
        }
        if (!page.publishedAt) data.publishedAt = new Date();
      }
      data.status = input.status;
    }

    let newSlug: string | undefined;
    if (input.slug !== undefined) {
      const candidate = normalizeSlugInput(input.slug);
      if (candidate !== page.slug) {
        const validation = validateSlug(candidate);
        if (!validation.valid) {
          throw new AppError(validation.reason, StatusCodes.UNPROCESSABLE_ENTITY, { slug: validation.reason });
        }
        newSlug = candidate;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (newSlug) {
        if (!(await isSlugFree(newSlug, tx, page.id))) {
          throw new AppError("Ce lien est déjà utilisé", StatusCodes.CONFLICT, { slug: "Ce lien est déjà utilisé" });
        }
        // Le slug cible quitte l'historique (réutilisation par la même page ou entrée expirée)
        await tx.eventPageSlugHistory.deleteMany({ where: { slugOld: newSlug } });
        // L'ancien slug redirige vers le nouveau (301) ; createdAt réinitialisé
        await tx.eventPageSlugHistory.upsert({
          where: { slugOld: page.slug },
          create: { slugOld: page.slug, eventPageId: page.id },
          update: { eventPageId: page.id, createdAt: new Date() },
        });
        data.slug = newSlug;
      }
      return tx.eventPage.update({ where: { id: page.id }, data });
    }).catch((err) => {
      if (isUniqueViolation(err)) {
        throw new AppError("Ce lien est déjà utilisé", StatusCodes.CONFLICT, { slug: "Ce lien est déjà utilisé" });
      }
      throw err;
    });

    return this.toOrganizerView(updated, event);
  },

  createPreviewToken(eventId: string, actor: Actor) {
    return (async () => {
      const event = await loadOwnedEvent(eventId, actor);
      const page = await this.ensurePageForEvent(event.id, event.title);
      const token = jwt.sign({ pageId: page.id, purpose: PREVIEW_PURPOSE }, previewSecret(), {
        expiresIn: PREVIEW_TOKEN_TTL,
      });
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      return { token, expiresAt, url: `${buildPageUrl(page.slug)}?preview=${encodeURIComponent(token)}` };
    })();
  },

  verifyPreviewToken(token: string | undefined): string | null {
    if (!token) return null;
    try {
      const payload = jwt.verify(token, previewSecret()) as { pageId?: string; purpose?: string };
      return payload.purpose === PREVIEW_PURPOSE && payload.pageId ? payload.pageId : null;
    } catch {
      return null;
    }
  },

  /** Ancien slug → slug courant (null si inconnu ou expiré). */
  async resolveRedirect(rawSlug: string): Promise<string | null> {
    const slug = normalizeSlugInput(rawSlug);
    const history = await prisma.eventPageSlugHistory.findUnique({
      where: { slugOld: slug },
      include: { eventPage: { select: { slug: true } } },
    });
    if (!history || isHistoryExpired(history.createdAt)) return null;
    return history.eventPage.slug;
  },

  /**
   * Lecture publique d'une page.
   * - 404 : slug inconnu, page ou événement en brouillon (aucun indice d'existence)
   * - 410 : événement supprimé, refusé ou annulé ; page archivée
   * - redirect : ancien slug renommé
   */
  async getPublicPage(rawSlug: string, previewToken?: string) {
    const slug = normalizeSlugInput(rawSlug);
    const page = await prisma.eventPage.findUnique({
      where: { slug },
      include: {
        event: {
          include: {
            organizer: { select: { id: true, name: true, photoUrl: true } },
            country: { select: { code: true, name: true } },
          },
        },
      },
    });

    if (!page) {
      const target = await this.resolveRedirect(slug);
      if (target) return { kind: "redirect" as const, slug: target };
      throw new AppError("Page introuvable", StatusCodes.NOT_FOUND);
    }

    const event = page.event;
    if (!event || GONE_EVENT_STATUSES.has(event.status) || page.status === "archived") {
      return { kind: "gone" as const };
    }

    const isPreview = this.verifyPreviewToken(previewToken) === page.id;
    const isVisible =
      (page.status === "published" || page.status === "paused") &&
      event.status === "published" &&
      !event.isPrivateForBadges;
    if (!isVisible && !isPreview) throw new AppError("Page introuvable", StatusCodes.NOT_FOUND);

    const tickets = parseTicketTypes(event);
    const startsAt = startsAtIso(event.date, event.time);
    const remaining = Math.max(0, event.maxAttendees - event.attendees);
    const ended = startsAt ? new Date(startsAt).getTime() < Date.now() : false;

    let salesStatus: "open" | "paused" | "blocked" | "soldout" | "ended" | "preview" = "open";
    if (ended) salesStatus = "ended";
    else if (page.status === "paused") salesStatus = "paused";
    else if (event.salesBlocked) salesStatus = "blocked";
    else if (remaining <= 0) salesStatus = "soldout";
    else if (!isVisible) salesStatus = "preview";

    const pageUrl = buildPageUrl(page.slug);
    const hero = page.heroImageUrl || event.image || null;
    const minPrice = tickets.length ? Math.min(...tickets.map((t) => t.price)) : null;
    const isStreamed = event.eventType === "STREAMING_LIVE" || event.eventType === "MIXTE";
    const description = (page.seoDescription || event.description || "").replace(/\s+/g, " ").trim();

    return {
      kind: "page" as const,
      preview: !isVisible,
      data: {
        slug: page.slug,
        status: page.status,
        salesStatus,
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          category: event.category,
          eventType: event.eventType,
          startsAt,
          date: event.date,
          time: event.time,
          duration: event.duration,
          venue: { name: event.location, country: event.country?.name ?? null, countryCode: event.countryCode },
          currency: event.currency,
          isLive: event.isLive,
        },
        organizer: { name: event.organizer?.name ?? "Organisateur", avatar: event.organizer?.photoUrl ?? null },
        tickets,
        availability: {
          remaining,
          lowStock: remaining > 0 && remaining <= LOW_STOCK_THRESHOLD,
        },
        priceFrom: minPrice,
        media: { hero, gallery: Array.isArray(page.gallery) ? page.gallery : [] },
        theme: {
          accent: (page.theme as { accent?: string } | null)?.accent || (isStreamed ? "#CDFF71" : "#811AEC"),
          sections: Array.isArray(page.sections) ? page.sections : [],
        },
        cta: { label: page.ctaLabel || "Prendre mon billet" },
        seo: {
          title: page.seoTitle || `${event.title} | Billets Fééti`.slice(0, 60),
          description: description.slice(0, 155),
          ogImage: page.ogImageUrl || hero,
          canonical: pageUrl,
          noindex: !isVisible,
        },
        links: {
          page: pageUrl,
          main: `${STORE_URL()}/events/${event.id}`,
          buy: `${STORE_URL()}/events/${event.id}/buy?return_url=${encodeURIComponent(pageUrl)}`,
          replay: isStreamed && PLAY_URL() ? `${PLAY_URL()}/event/feeti2_live_${event.id}` : null,
        },
        updatedAt: (page.updatedAt > event.updatedAt ? page.updatedAt : event.updatedAt).toISOString(),
      },
    };
  },

  toOrganizerView(page: Awaited<ReturnType<typeof prisma.eventPage.findUniqueOrThrow>>, event: EventRow) {
    const blockers = publicationBlockers(event, page.heroImageUrl);
    return {
      id: page.id,
      eventId: page.eventId,
      slug: page.slug,
      status: page.status,
      showOnMainSite: page.showOnMainSite,
      ctaLabel: page.ctaLabel,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
      url: buildPageUrl(page.slug),
      rootDomain: ROOT_DOMAIN(),
      canPublish: blockers.length === 0,
      publicationBlockers: blockers,
      event: { id: event.id, title: event.title, date: event.date, time: event.time, location: event.location, image: event.image, status: event.status },
    };
  },
};
