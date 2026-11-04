/**
 * Règles de slug des pages événement ({slug}.feeti.io).
 * Un slug est un label DNS : 3 à 40 caractères, [a-z0-9-], ni tiret initial/final ni double tiret.
 */

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$/;

/** Sous-domaines réservés (infrastructure, produits Feeti, usurpation évidente). */
export const RESERVED_SLUGS = new Set([
  "www", "api", "app", "apps", "play", "store", "admin", "administrateur", "mail", "email", "smtp",
  "imap", "pop", "mx", "ns", "ns1", "ns2", "dns", "cdn", "static", "assets", "media", "img", "images",
  "status", "staging", "preview", "dev", "test", "demo", "beta", "docs", "help", "aide", "support",
  "blog", "auth", "login", "connexion", "signup", "inscription", "account", "compte", "billing",
  "pay", "payment", "paiement", "checkout", "secure", "security", "ftp", "vpn", "git", "ci",
  "feeti", "feetiplay", "feetistore", "feeti-play", "feeti-store", "ticket", "tickets", "billet",
  "billets", "events", "event", "evenement", "evenements", "official", "officiel", "root", "system",
]);

export type SlugValidation = { valid: true } | { valid: false; reason: string };

/** Normalise un texte libre (titre) en slug candidat — sans garantie de longueur minimale. */
export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return truncateSlug(base, SLUG_MAX_LENGTH);
}

/** Coupe un slug à `max` caractères sans laisser de tiret final. */
export function truncateSlug(slug: string, max: number): string {
  return slug.slice(0, max).replace(/-+$/g, "");
}

/** Normalise une saisie utilisateur (casse, espaces) avant validation. */
export function normalizeSlugInput(input: string): string {
  return input.trim().toLowerCase();
}

export function validateSlug(slug: string): SlugValidation {
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) {
    return { valid: false, reason: `Le lien doit contenir entre ${SLUG_MIN_LENGTH} et ${SLUG_MAX_LENGTH} caractères` };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      valid: false,
      reason: "Utilisez uniquement des lettres minuscules, des chiffres et des tirets (pas de tiret au début, à la fin ou en double)",
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, reason: "Ce lien est réservé par Feeti" };
  }
  return { valid: true };
}

/**
 * Slug de base à partir d'un titre : complète les titres trop courts ou vides,
 * et évite les slugs réservés.
 */
export function baseSlugFromTitle(title: string): string {
  let slug = slugify(title);
  if (slug.length < SLUG_MIN_LENGTH) slug = slug ? `${slug}-event` : "mon-evenement";
  if (RESERVED_SLUGS.has(slug)) slug = `${slug}-event`;
  return slug;
}

/** Variante numérotée : `kora-fest` + 2 → `kora-fest-2`, en restant sous la longueur maximale. */
export function withNumericSuffix(base: string, n: number): string {
  const suffix = `-${n}`;
  return `${truncateSlug(base, SLUG_MAX_LENGTH - suffix.length)}${suffix}`;
}
