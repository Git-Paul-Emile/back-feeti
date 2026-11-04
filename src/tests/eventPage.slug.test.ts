import { describe, it, expect, vi } from "vitest";

vi.mock("../config/database.js", () => ({ prisma: {} }));

import {
  slugify,
  validateSlug,
  baseSlugFromTitle,
  withNumericSuffix,
  normalizeSlugInput,
  SLUG_MAX_LENGTH,
} from "../utils/slug.js";
import { generateUniqueSlug, parseTicketTypes, publicationBlockers } from "../services/eventPage.service.js";

describe("slugify", () => {
  it("normalise un titre accentué", () => {
    expect(slugify("Kora Fest 2026")).toBe("kora-fest-2026");
    expect(slugify("Fête de la Musique — Brazzaville !")).toBe("fete-de-la-musique-brazzaville");
    expect(slugify("  L'été   à   Pointe-Noire  ")).toBe("lete-a-pointe-noire");
  });

  it("coupe à 40 caractères sans tiret final", () => {
    const slug = slugify("Un titre vraiment très très long pour un événement musical de fin d'année");
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("validateSlug", () => {
  it.each(["kora-fest-2026", "abc", "a1b", "x".repeat(40)])("accepte %s", (s) => {
    expect(validateSlug(s).valid).toBe(true);
  });

  it.each([
    ["ab", "trop court"],
    ["x".repeat(41), "trop long"],
    ["-kora", "tiret initial"],
    ["kora-", "tiret final"],
    ["kora--fest", "double tiret"],
    ["Kora", "majuscule"],
    ["kora_fest", "underscore"],
    ["koré", "accent"],
  ])("refuse %s (%s)", (s) => {
    expect(validateSlug(s).valid).toBe(false);
  });

  it.each(["www", "api", "admin", "play", "store", "mail", "cdn", "static", "status"])("refuse le slug réservé %s", (s) => {
    const r = validateSlug(s);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/réservé/);
  });

  it("normalise la saisie", () => {
    expect(normalizeSlugInput("  Kora-Fest ")).toBe("kora-fest");
  });
});

describe("baseSlugFromTitle / withNumericSuffix", () => {
  it("complète les titres trop courts ou réservés", () => {
    expect(baseSlugFromTitle("!!")).toBe("mon-evenement");
    expect(baseSlugFromTitle("DJ")).toBe("dj-event");
    expect(baseSlugFromTitle("Admin")).toBe("admin-event");
    expect(validateSlug(baseSlugFromTitle("Play")).valid).toBe(true);
  });

  it("ajoute un suffixe en restant sous 40 caractères", () => {
    expect(withNumericSuffix("kora-fest-2026", 2)).toBe("kora-fest-2026-2");
    const long = "x".repeat(40);
    const suffixed = withNumericSuffix(long, 12);
    expect(suffixed.length).toBe(40);
    expect(suffixed.endsWith("-12")).toBe(true);
  });
});

describe("generateUniqueSlug", () => {
  const dbWith = (taken: string[], history: Record<string, Date> = {}) => ({
    eventPage: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) =>
        taken.includes(where.slug) ? { id: `page-${where.slug}` } : null),
    },
    eventPageSlugHistory: {
      findUnique: vi.fn(async ({ where }: { where: { slugOld: string } }) =>
        history[where.slugOld] ? { eventPageId: "other", createdAt: history[where.slugOld] } : null),
    },
  }) as any;

  it("renvoie le slug de base s'il est libre", async () => {
    expect(await generateUniqueSlug("Kora Fest 2026", dbWith([]))).toBe("kora-fest-2026");
  });

  it("ajoute un suffixe numérique en cas de doublon", async () => {
    const db = dbWith(["kora-fest-2026", "kora-fest-2026-2"]);
    expect(await generateUniqueSlug("Kora Fest 2026", db)).toBe("kora-fest-2026-3");
  });

  it("ne réutilise pas un ancien slug encore redirigé", async () => {
    const db = dbWith([], { "kora-fest-2026": new Date() });
    expect(await generateUniqueSlug("Kora Fest 2026", db)).toBe("kora-fest-2026-2");
  });

  it("réutilise un ancien slug dont la redirection a expiré (12 mois)", async () => {
    const old = new Date();
    old.setMonth(old.getMonth() - 13);
    const db = dbWith([], { "kora-fest-2026": old });
    expect(await generateUniqueSlug("Kora Fest 2026", db)).toBe("kora-fest-2026");
  });
});

describe("parseTicketTypes", () => {
  it("lit la chaîne JSON des types de billets", () => {
    const t = parseTicketTypes({ ticketTypes: '[{"type":"Standard","price":5000},{"type":"VIP","price":15000}]', price: 0, vipPrice: null });
    expect(t).toEqual([
      { id: "Standard", name: "Standard", price: 5000 },
      { id: "VIP", name: "VIP", price: 15000 },
    ]);
  });

  it("retombe sur price / vipPrice si ticketTypes est vide ou invalide", () => {
    expect(parseTicketTypes({ ticketTypes: "oops", price: 3000, vipPrice: 9000 })).toEqual([
      { id: "Standard", name: "Standard", price: 3000 },
      { id: "VIP", name: "VIP", price: 9000 },
    ]);
  });
});

describe("publicationBlockers", () => {
  const base = {
    title: "Kora Fest", date: "2026-12-12", time: "19:00", location: "Palais du Peuple",
    image: "https://cdn/x.webp", ticketTypes: '[{"type":"Standard","price":5000}]', price: 0, vipPrice: null,
    status: "published",
  } as any;

  it("autorise un événement complet et validé", () => {
    expect(publicationBlockers(base)).toEqual([]);
  });

  it("liste les manques", () => {
    expect(publicationBlockers({ ...base, image: "", location: " ", status: "draft" })).toEqual([
      "lieu", "visuel principal", "validation de l'événement par Feeti",
    ]);
  });

  it("accepte un visuel de page à la place de l'image de l'événement", () => {
    expect(publicationBlockers({ ...base, image: "" }, "https://cdn/hero.webp")).toEqual([]);
  });
});
