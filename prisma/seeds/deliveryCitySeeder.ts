import { PrismaClient } from '../../src/generated/prisma/client.js';

// [cityName, countryCode, zoneNameKey]
const CITIES: [string, string, string][] = [
  // ── République du Congo – Brazzaville (Centre-ville) ───────────────────
  ['Plateau',       'CG', 'Centre-ville'],
  ['Poto-Poto',     'CG', 'Centre-ville'],
  ['Bacongo',       'CG', 'Centre-ville'],
  ['Moungali',      'CG', 'Centre-ville'],
  ['Ouenzé',        'CG', 'Centre-ville'],
  ['Makélékélé',    'CG', 'Centre-ville'],
  ['Lumumba',       'CG', 'Centre-ville'],
  ['Tie-Tie',       'CG', 'Centre-ville'],

  // ── République du Congo – Brazzaville (Périphérie) ─────────────────────
  ['Talangaï',      'CG', 'Périphérie'],
  ['Mfilou',        'CG', 'Périphérie'],
  ['Djiri',         'CG', 'Périphérie'],
  ['Nkombo',        'CG', 'Périphérie'],
  ['Tchinouka',     'CG', 'Périphérie'],
  ['Mpaka',         'CG', 'Périphérie'],
  ['Mongo-Mpoukou', 'CG', 'Périphérie'],

  // ── République du Congo – Brazzaville (Banlieue) ───────────────────────
  ['Kintélé',       'CG', 'Banlieue'],
  ['Ignié',         'CG', 'Banlieue'],
  ['Nganga-Lingolo','CG', 'Banlieue'],

  // ── Gabon – Libreville (Centre) ─────────────────────────────────────────
  ['Centre-ville',  'GA', 'Centre'],
  ['Glass',         'GA', 'Centre'],
  ['Louis',         'GA', 'Centre'],
  ['Montagne Sainte', 'GA', 'Centre'],
  ['Port-Gentil centre', 'GA', 'Centre'],

  // ── Gabon – Libreville (Périphérie) ─────────────────────────────────────
  ['Akanda',        'GA', 'Périphérie'],
  ['Owendo',        'GA', 'Périphérie'],
  ['PK 8',          'GA', 'Périphérie'],
  ['PK 12',         'GA', 'Périphérie'],
  ['Sogara',        'GA', 'Périphérie'],

  // ── Gabon – Grand Libreville ─────────────────────────────────────────────
  ['Ntoum',         'GA', 'Grand Libreville'],
  ['Kango',         'GA', 'Grand Libreville'],

  // ── RD Congo – Kinshasa (Centre) ────────────────────────────────────────
  ['Gombe',         'CD', 'Centre'],
  ['Lingwala',      'CD', 'Centre'],
  ['Kinshasa',      'CD', 'Centre'],

  // ── RD Congo – Kinshasa (Communes) ──────────────────────────────────────
  ['Ngaliema',      'CD', 'Communes'],
  ['Barumbu',       'CD', 'Communes'],
  ['Kintambo',      'CD', 'Communes'],
  ['Lemba',         'CD', 'Communes'],
  ['Matete',        'CD', 'Communes'],
  ['Kalamu',        'CD', 'Communes'],
  ['Kasa-Vubu',     'CD', 'Communes'],
  ['Bandalungwa',   'CD', 'Communes'],

  // ── RD Congo – Kinshasa (Banlieue) ──────────────────────────────────────
  ['Ndjili',        'CD', 'Banlieue'],
  ['Masina',        'CD', 'Banlieue'],
  ['Kimbanseke',    'CD', 'Banlieue'],
  ['Mont-Ngafula',  'CD', 'Banlieue'],
  ['Selembao',      'CD', 'Banlieue'],

  // ── Côte d'Ivoire – Abidjan (Plateau) ───────────────────────────────────
  ['Plateau',       'CI', 'Plateau'],
  ['Treichville',   'CI', 'Plateau'],
  ['Marcory',       'CI', 'Plateau'],
  ['Koumassi',      'CI', 'Plateau'],

  // ── Côte d'Ivoire – Abidjan (Communes) ──────────────────────────────────
  ['Cocody',        'CI', 'Communes'],
  ['Adjamé',        'CI', 'Communes'],
  ['Abobo',         'CI', 'Communes'],
  ['Yopougon',      'CI', 'Communes'],
  ['Attécoubé',     'CI', 'Communes'],
  ['Williamsville', 'CI', 'Communes'],

  // ── Côte d'Ivoire – Grand Abidjan ───────────────────────────────────────
  ['Bingerville',   'CI', 'Grand Abidjan'],
  ['Anyama',        'CI', 'Grand Abidjan'],
  ['Songon',        'CI', 'Grand Abidjan'],
  ['Jacqueville',   'CI', 'Grand Abidjan'],
];

export async function seedDeliveryCities(prisma: PrismaClient, zoneIdMap: Map<string, string>) {
  let count = 0;

  for (const [name, countryCode, zoneName] of CITIES) {
    const zoneId = zoneIdMap.get(`${countryCode}|${zoneName}`);
    if (!zoneId) {
      console.warn(`⚠️  Zone introuvable : ${countryCode}|${zoneName} pour la ville "${name}"`);
      continue;
    }

    await prisma.city.upsert({
      where: { name_countryCode: { name, countryCode } },
      update: { zoneId },
      create: { name, countryCode, zoneId, isActive: true },
    });
    count++;
  }

  console.log(`✅ ${count} villes/communes insérées`);
}
