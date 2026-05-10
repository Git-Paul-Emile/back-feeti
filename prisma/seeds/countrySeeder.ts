import { PrismaClient } from '../../src/generated/prisma/client.js';

export const COUNTRIES = [
  { code: 'CG', name: 'République du Congo', flag: '🇨🇬' },
  { code: 'CD', name: 'RDC',                  flag: '🇨🇩' },
  { code: 'GA', name: 'Gabon',                flag: '🇬🇦' },
  { code: 'CI', name: "Côte d'Ivoire",        flag: '🇨🇮' },
];

export async function seedCountries(prisma: PrismaClient) {
  for (const country of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: { name: country.name, flag: country.flag, isActive: true },
      create: { ...country, isActive: true },
    });
  }
  console.log(`✅ ${COUNTRIES.length} pays insérés (CG, CD, GA, CI)`);
}
