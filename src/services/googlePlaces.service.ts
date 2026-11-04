import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

// Récupère des établissements depuis Google Places (Text Search, API "New")
// pour alimenter la page Loisirs selon le pays sélectionné.
// Clé requise : GOOGLE_PLACES_API_KEY (API "Places API (New)" activée).

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.editorialSummary",
  "places.photos",
].join(",");

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 h : limite le coût des appels Google
const MAX_RESULTS = 12;

// Requête Google par catégorie Feeti Loisirs
const CATEGORY_QUERIES: Record<string, { query: string; name: string }> = {
  restaurants: { query: "meilleurs restaurants", name: "Restaurants" },
  hotels: { query: "hôtels", name: "Hôtels" },
  sports: { query: "salles de sport, spas et bien-être", name: "Sport & Bien-être" },
  envolee: { query: "sites touristiques et lieux d'évasion", name: "Évasion" },
  loisirs: { query: "activités et parcs de loisirs", name: "Loisirs" },
  "bar-night": { query: "bars et boîtes de nuit", name: "Bar & Nuit" },
};

const PRICE_LEVELS: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE: "€",
  PRICE_LEVEL_MODERATE: "€€",
  PRICE_LEVEL_EXPENSIVE: "€€€",
  PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
};

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  editorialSummary?: { text: string };
  photos?: { name: string; authorAttributions?: { displayName: string }[] }[];
}

// Même forme qu'un LeisureItem Feeti, avec source = "google"
export interface GoogleLeisureItem {
  id: string;
  source: "google";
  name: string;
  description: string;
  categorySlug: string;
  category: { id: string; name: string; slug: string; createdAt: string };
  location: string;
  address?: string;
  phone?: string;
  website?: string;
  googleMapsUri?: string;
  priceRange?: string;
  openingHours?: string;
  image: string;
  photoAttribution?: string;
  rating?: number;
  reviewCount?: number;
  features: string;
  tags: string;
  status: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

const cache = new Map<string, { at: number; items: GoogleLeisureItem[] }>();
let missingKeyLogged = false;

async function resolvePhotoUri(photoName: string, key: string): Promise<string> {
  // skipHttpRedirect renvoie une URL publique (sans clé) utilisable directement par le front
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=900&skipHttpRedirect=true&key=${key}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const data = (await res.json()) as { photoUri?: string };
    return data.photoUri ?? "";
  } catch {
    return "";
  }
}

function todayHours(descriptions?: string[]): string | undefined {
  if (!descriptions?.length) return undefined;
  // weekdayDescriptions commence le lundi ; getDay() commence le dimanche
  const index = (new Date().getDay() + 6) % 7;
  return descriptions[index] ?? descriptions[0];
}

export const googlePlacesService = {
  isConfigured(): boolean {
    return Boolean(process.env.GOOGLE_PLACES_API_KEY);
  },

  supportedCategories(): string[] {
    return Object.keys(CATEGORY_QUERIES);
  },

  async searchLeisure(countryCode: string, categorySlug?: string): Promise<GoogleLeisureItem[]> {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) {
      if (!missingKeyLogged) {
        logger.warn("[googlePlaces] GOOGLE_PLACES_API_KEY absente : aucun résultat Google pour les loisirs");
        missingKeyLogged = true;
      }
      return [];
    }

    const code = countryCode.toUpperCase();
    const slugs = categorySlug && CATEGORY_QUERIES[categorySlug] ? [categorySlug] : Object.keys(CATEGORY_QUERIES);
    const country = await prisma.country.findUnique({ where: { code }, select: { name: true } });
    if (!country) return [];

    const perCategory = await Promise.all(slugs.map((slug) => this.searchCategory(code, country.name, slug, key)));
    // Vue « toutes catégories » : on alterne les catégories pour garder de la variété
    if (slugs.length === 1) return perCategory[0];
    const mixed: GoogleLeisureItem[] = [];
    for (let i = 0; mixed.length < MAX_RESULTS * 2 && perCategory.some((list) => i < list.length); i++) {
      for (const list of perCategory) if (list[i]) mixed.push(list[i]);
    }
    return mixed;
  },

  async searchCategory(code: string, countryName: string, slug: string, key: string): Promise<GoogleLeisureItem[]> {
    const cacheKey = `${code}:${slug}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items;

    const { query, name: categoryName } = CATEGORY_QUERIES[slug];
    let places: GooglePlace[] = [];
    try {
      const res = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: `${query} ${countryName}`,
          languageCode: "fr",
          regionCode: code,
          pageSize: MAX_RESULTS,
        }),
      });
      if (!res.ok) {
        logger.error(`[googlePlaces] recherche ${cacheKey} échouée : HTTP ${res.status} ${await res.text()}`);
        return hit?.items ?? [];
      }
      places = ((await res.json()) as { places?: GooglePlace[] }).places ?? [];
    } catch (err) {
      logger.error(`[googlePlaces] recherche ${cacheKey} impossible :`, err);
      return hit?.items ?? [];
    }

    const now = new Date().toISOString();
    const items = await Promise.all(
      places.map(async (p): Promise<GoogleLeisureItem> => {
        const photo = p.photos?.[0];
        const address = p.formattedAddress;
        return {
          id: `google_${p.id}`,
          source: "google",
          name: p.displayName?.text ?? "Établissement",
          description: p.editorialSummary?.text ?? address ?? "",
          categorySlug: slug,
          category: { id: `google_${slug}`, name: categoryName, slug, createdAt: now },
          location: p.shortFormattedAddress ?? address ?? countryName,
          address,
          phone: p.nationalPhoneNumber,
          website: p.websiteUri,
          googleMapsUri: p.googleMapsUri,
          priceRange: p.priceLevel ? PRICE_LEVELS[p.priceLevel] : undefined,
          openingHours: todayHours(p.regularOpeningHours?.weekdayDescriptions),
          image: photo ? await resolvePhotoUri(photo.name, key) : "",
          photoAttribution: photo?.authorAttributions?.[0]?.displayName,
          rating: p.rating,
          reviewCount: p.userRatingCount,
          features: "[]",
          tags: JSON.stringify([categoryName]),
          status: "published",
          countryCode: code,
          latitude: p.location?.latitude,
          longitude: p.location?.longitude,
          createdById: "google",
          createdAt: now,
          updatedAt: now,
        };
      })
    );

    cache.set(cacheKey, { at: Date.now(), items });
    return items;
  },
};
