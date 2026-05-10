import { PrismaClient } from '../../src/generated/prisma/client.js';

export const DELIVERY_ZONES = [
  // ── République du Congo (CG) ────────────────────────────────────────────
  { name: 'Centre-ville',    countryCode: 'CG', fee: 500,  currency: 'FCFA', description: 'Brazzaville centre, Pointe-Noire centre' },
  { name: 'Périphérie',      countryCode: 'CG', fee: 1000, currency: 'FCFA', description: 'Quartiers résidentiels éloignés' },
  { name: 'Banlieue',        countryCode: 'CG', fee: 1500, currency: 'FCFA', description: 'Communes et banlieues' },

  // ── Gabon (GA) ──────────────────────────────────────────────────────────
  { name: 'Centre',          countryCode: 'GA', fee: 1000, currency: 'FCFA', description: 'Libreville centre, Port-Gentil centre' },
  { name: 'Périphérie',      countryCode: 'GA', fee: 2000, currency: 'FCFA', description: 'Quartiers résidentiels éloignés' },
  { name: 'Grand Libreville', countryCode: 'GA', fee: 3000, currency: 'FCFA', description: 'Communes limitrophes de Libreville' },

  // ── RD Congo (CD) ───────────────────────────────────────────────────────
  { name: 'Centre',          countryCode: 'CD', fee: 2000, currency: 'FCFA', description: 'Kinshasa centre, Gombe' },
  { name: 'Communes',        countryCode: 'CD', fee: 3500, currency: 'FCFA', description: 'Communes résidentielles' },
  { name: 'Banlieue',        countryCode: 'CD', fee: 5000, currency: 'FCFA', description: 'Périphérie de Kinshasa' },

  // ── Côte d'Ivoire (CI) ─────────────────────────────────────────────────
  { name: 'Plateau',         countryCode: 'CI', fee: 500,  currency: 'FCFA', description: 'Plateau, Treichville, Marcory' },
  { name: 'Communes',        countryCode: 'CI', fee: 1000, currency: 'FCFA', description: 'Cocody, Yopougon, Adjamé, Abobo' },
  { name: 'Grand Abidjan',   countryCode: 'CI', fee: 2000, currency: 'FCFA', description: 'Communes éloignées et banlieue' },
];

export async function seedDeliveryZones(prisma: PrismaClient): Promise<Map<string, string>> {
  const zoneIdMap = new Map<string, string>(); // "CG|Centre-ville" → id

  for (const zone of DELIVERY_ZONES) {
    const upserted = await prisma.deliveryZone.upsert({
      where: { name_countryCode: { name: zone.name, countryCode: zone.countryCode } },
      update: { fee: zone.fee, currency: zone.currency, description: zone.description },
      create: { ...zone, isActive: true },
    });
    zoneIdMap.set(`${zone.countryCode}|${zone.name}`, upserted.id);
  }

  console.log(`✅ ${DELIVERY_ZONES.length} zones de livraison insérées`);
  return zoneIdMap;
}
