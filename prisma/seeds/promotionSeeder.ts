import type { PrismaClient } from '../../src/generated/prisma/client.js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Seed des PROMOTIONS D'ÉVÉNEMENTS (packs OR / ARGENT / BRONZE)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  POURQUOI CE SEEDER EXISTE
 *  -------------------------
 *  La page d'accueil de FeetiTicket n'affiche PAS tous les événements dans ses
 *  sections vitrines. Chaque section lit un pack de promotion précis :
 *
 *      Pack OR      → SliderOriginalInteractif  (le grand hero banner)
 *      Pack ARGENT  → ArgentSlider              (le carrousel juste en dessous)
 *      Pack BRONZE  → « Événements à la une »   (la grille de HomePage)
 *      Pack LITE    → listing normal renforcé   (pas de section dédiée)
 *
 *  Le filtre côté front (src/components/SliderOriginalInteractif.tsx) est :
 *
 *      events.filter(e => isEventPromotionActive(e) && e.promotionType === 'OR')
 *
 *  et `isEventPromotionActive` exige `promotionStatus === 'active'` avec des
 *  dates de promotion encadrant la date du jour.
 *
 *  Conséquence : sur une base fraîchement seedée, TOUS les événements ont
 *  `promotionType: null` et `promotionStatus: 'inactive'`. Les trois sections
 *  vitrines sont donc VIDES — en local comme en production — alors que les
 *  événements existent bel et bien. C'est exactement le symptôme « rien ne
 *  s'affiche dans le slider ». Ce seeder simule l'achat de packs pour combler
 *  ce trou.
 *
 *  CE QUE LE SEEDER RESPECTE (mêmes règles que le vrai achat self-service,
 *  voir src/controller/promotion.controller.ts → purchaseEventPromotion)
 *  --------------------------------------------------------------------------
 *   1. Seuls les événements `status: 'published'` peuvent être promus.
 *   2. Les limites de slots simultanés sont respectées : OR=2, ARGENT=5,
 *      BRONZE=10 (constante SLOT_LIMITS du contrôleur).
 *   3. Un achat (`PromotionPurchase`) est créé ET l'événement est mis à jour
 *      (`promotionType`, `promotionStatus`, dates) dans une seule transaction :
 *      les deux tables ne peuvent pas diverger.
 *   4. La durée provient de `PromotionPackConfig.durationDays` (comme en prod).
 *
 *  IDEMPOTENCE
 *  -----------
 *  Les achats créés ici sont marqués `paymentProvider: 'seed'`. À chaque
 *  exécution, on purge d'abord CES achats-là et on remet à zéro les événements
 *  concernés. On peut donc relancer `npm run seed` autant de fois qu'on veut :
 *  aucun doublon, et surtout aucune promotion réellement achetée par un
 *  organisateur n'est touchée.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Marqueur qui distingue une promotion de seed d'un vrai achat organisateur. */
const SEED_MARKER = 'seed';

/** Limites de slots simultanés — doit rester aligné sur SLOT_LIMITS du contrôleur. */
const SLOT_LIMITS: Record<string, number> = { OR: 2, ARGENT: 5, BRONZE: 10, LITE: 9999 };

/**
 * Configurations par défaut des packs.
 * Copie de DEFAULT_PACK_CONFIGS (promotion.controller.ts) : le contrôleur les
 * crée à la volée via ensurePackConfigs(), mais le seeder doit pouvoir tourner
 * sur une base neuve où aucune requête HTTP n'a encore été passée.
 */
const DEFAULT_PACK_CONFIGS: Record<
  string,
  { price: number; currency: string; description: string; advantages: string[]; durationDays: number }
> = {
  OR: {
    price: 49000,
    currency: 'FCFA',
    description: 'La vitrine premium de vos événements — visibilité maximale sur toute la plateforme Feeti.',
    advantages: [
      'Position #1 sur la homepage',
      "Bannière dans la catégorie de l'événement",
      'Inclusion dans la newsletter Feeti',
      'Résultats de recherche prioritaires',
      'Badge OR affiché sur toutes les fiches',
      'Accès aux analytics avancés',
      'Support prioritaire 24h/48h',
    ],
    durationDays: 60,
  },
  ARGENT: {
    price: 29000,
    currency: 'FCFA',
    description: 'Mise en avant ciblée pour booster vos ventes en phase finale.',
    advantages: [
      'Top 3 sur la homepage',
      'Section Événements à la une',
      'Inclusion dans la newsletter Feeti',
      'Badge ARGENT affiché sur les fiches',
      'Résultats de recherche mis en avant',
      'Analytics standard',
    ],
    durationDays: 60,
  },
  BRONZE: {
    price: 15000,
    currency: 'FCFA',
    description: 'Visibilité renforcée pour attirer plus d\'acheteurs vers votre événement.',
    advantages: [
      'Section Événements à la une',
      'Position renforcée dans le listing',
      'Badge BRONZE affiché sur les fiches',
      'Analytics de base',
    ],
    durationDays: 45,
  },
  LITE: {
    price: 5000,
    currency: 'FCFA',
    description: 'Premier pas dans la mise en avant — idéal pour tester la visibilité.',
    advantages: ['Position renforcée dans le listing', 'Badge LITE affiché sur les fiches'],
    durationDays: 30,
  },
};

/**
 * Combien d'événements on veut promouvoir par pack.
 * On reste volontairement SOUS la limite de slots pour laisser de la place aux
 * vrais achats des organisateurs (ex. 2 slots OR : on en occupe 2 en local,
 * mais le calcul de places restantes ci-dessous s'adapte automatiquement).
 */
const SEED_PLAN: Array<{ packType: 'OR' | 'ARGENT' | 'BRONZE'; wanted: number }> = [
  { packType: 'OR', wanted: 2 },
  { packType: 'ARGENT', wanted: 4 },
  { packType: 'BRONZE', wanted: 6 },
];

/**
 * Crée les PromotionPackConfig manquantes (équivalent de ensurePackConfigs()).
 * `update: {}` = on ne réécrit jamais une config déjà ajustée par un admin.
 */
async function ensurePackConfigs(prisma: PrismaClient) {
  for (const [type, defaults] of Object.entries(DEFAULT_PACK_CONFIGS)) {
    await prisma.promotionPackConfig.upsert({
      where: { type },
      create: {
        type,
        price: defaults.price,
        currency: defaults.currency,
        description: defaults.description,
        advantages: JSON.stringify(defaults.advantages),
        durationDays: defaults.durationDays,
      },
      update: {},
    });
  }
}

/**
 * Remet à zéro UNIQUEMENT les promotions créées par ce seeder.
 * Les achats réels des organisateurs (paymentProvider ≠ 'seed') sont préservés.
 */
async function resetSeededPromotions(prisma: PrismaClient) {
  const seeded = await prisma.promotionPurchase.findMany({
    where: { paymentProvider: SEED_MARKER },
    select: { eventId: true },
  });

  if (seeded.length === 0) return 0;

  const eventIds = [...new Set(seeded.map((p) => p.eventId))];

  // On ne remet à zéro un événement que s'il n'a AUCUN autre achat réel actif :
  // sinon on effacerait une promotion payée par un organisateur.
  for (const eventId of eventIds) {
    const realPurchase = await prisma.promotionPurchase.findFirst({
      where: {
        eventId,
        paymentProvider: { not: SEED_MARKER },
        status: { in: ['completed', 'pending_payment'] },
        promotionEndDate: { gte: new Date() },
      },
    });
    if (realPurchase) continue;

    await prisma.event.update({
      where: { id: eventId },
      data: {
        promotionType: null,
        promotionStatus: 'inactive',
        promotionStartDate: null,
        promotionEndDate: null,
      },
    });
  }

  await prisma.promotionPurchase.deleteMany({ where: { paymentProvider: SEED_MARKER } });
  return eventIds.length;
}

export async function seedPromotions(prisma: PrismaClient) {
  console.log('  ⭐  Seeding Promotions (OR / ARGENT / BRONZE → vitrines homepage)...');

  await ensurePackConfigs(prisma);

  const reset = await resetSeededPromotions(prisma);
  if (reset > 0) console.log(`  ♻️   ${reset} promotion(s) de seed précédentes purgées.`);

  const now = new Date();

  // Événements éligibles : publiés et pas déjà promus (les vrais achats restent
  // intacts). Les plus récents d'abord — ce sont les plus pertinents en vitrine.
  const eligible = await prisma.event.findMany({
    where: {
      status: 'published',
      OR: [{ promotionStatus: { not: 'active' } }, { promotionStatus: null }],
    },
    orderBy: [{ isLive: 'desc' }, { date: 'desc' }],
    select: { id: true, title: true, organizerId: true },
  });

  if (eligible.length === 0) {
    console.warn('  ⚠️   Aucun événement publié — lance seedEvents d\'abord. Ignoré.');
    return;
  }

  let cursor = 0; // position dans la liste des événements éligibles
  const report: string[] = [];

  for (const { packType, wanted } of SEED_PLAN) {
    const cfg = await prisma.promotionPackConfig.findUnique({ where: { type: packType } });
    if (!cfg) {
      console.warn(`  ⚠️   Config du pack ${packType} introuvable. Ignoré.`);
      continue;
    }

    // Places réellement disponibles = limite du pack − promotions actives réelles
    const activeCount = await prisma.event.count({
      where: {
        promotionType: packType,
        promotionStatus: 'active',
        OR: [{ promotionEndDate: null }, { promotionEndDate: { gte: now } }],
      },
    });

    const free = Math.max(0, (SLOT_LIMITS[packType] ?? 0) - activeCount);
    const toPromote = Math.min(wanted, free, eligible.length - cursor);

    if (toPromote <= 0) {
      report.push(`     • ${packType.padEnd(6)} — 0 (slots occupés : ${activeCount}/${SLOT_LIMITS[packType]})`);
      continue;
    }

    const startDate = now;
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + cfg.durationDays);

    for (let i = 0; i < toPromote; i++) {
      const event = eligible[cursor++];

      // Achat + activation dans une seule transaction : impossible de créer un
      // PromotionPurchase sans activer l'événement, ou l'inverse.
      await prisma.$transaction(async (tx) => {
        await tx.promotionPurchase.create({
          data: {
            eventId: event.id,
            organizerId: event.organizerId,
            packType,
            pricePaid: cfg.price,
            currency: cfg.currency,
            status: 'completed',
            paymentMode: 'immediate',
            paymentStatus: 'completed',
            paymentProvider: SEED_MARKER,
            paymentSimulated: true,
            promotionStartDate: startDate,
            promotionEndDate: endDate,
            notes: 'Promotion générée par le seeder (données de démonstration)',
          },
        });

        await tx.event.update({
          where: { id: event.id },
          data: {
            promotionType: packType,
            promotionStatus: 'active',
            promotionStartDate: startDate,
            promotionEndDate: endDate,
          },
        });
      });
    }

    report.push(
      `     • ${packType.padEnd(6)} — ${toPromote} événement(s), valable ${cfg.durationDays} j (jusqu'au ${endDate.toISOString().slice(0, 10)})`
    );
  }

  console.log('  ✅  Promotions seedées :');
  report.forEach((line) => console.log(line));
  console.log('        → Pack OR alimente le hero slider de la page d\'accueil.');
}
