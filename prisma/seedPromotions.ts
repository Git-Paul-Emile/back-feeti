import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedPromotions } from './seeds/promotionSeeder.js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  POINT D'ENTRÉE AUTONOME — promotions uniquement
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  À quoi ça sert ?
 *  ----------------
 *  `npm run seed` rejoue TOUS les seeders : utilisateurs, événements, deals,
 *  loisirs, articles de blog… Sur une base de PRODUCTION c'est destructeur —
 *  `seedEvents` commence par `prisma.event.deleteMany({ where: { organizerId } })`,
 *  ce qui supprimerait les événements réels de cet organisateur.
 *
 *  Ce script-ci ne touche QUE :
 *      • la table PromotionPackConfig (upsert non destructif)
 *      • les PromotionPurchase marquées `paymentProvider: 'seed'`
 *      • les colonnes promotion* des événements que ce seeder a lui-même promus
 *
 *  Il est donc sûr à lancer sur la base Render pour rallumer les vitrines.
 *
 *  Utilisation
 *  -----------
 *      # en local
 *      npm run seed:promotions
 *
 *      # sur la base de production (DATABASE_URL de Render)
 *      DATABASE_URL="postgresql://…" npm run seed:promotions
 * ─────────────────────────────────────────────────────────────────────────────
 */

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding des promotions (packs OR / ARGENT / BRONZE)...\n');
  await seedPromotions(prisma);
  console.log('\n🎉 Terminé — rafraîchis la page d\'accueil pour voir le slider.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur seeding promotions:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
