/**
 * Crée une page événement (draft) pour chaque Event qui n'en a pas.
 * Idempotent. Usage : npx tsx scripts/backfill-event-pages.ts [--dry-run]
 * Les événements déjà publiés restent en draft : l'organisateur publie lui-même sa page.
 */
import "dotenv/config";
import { prisma } from "../src/config/database.js";
import { eventPageService, generateUniqueSlug } from "../src/services/eventPage.service.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const events = await prisma.event.findMany({
    where: { eventPage: { is: null } },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`[backfill] ${events.length} événement(s) sans page${dryRun ? " (dry-run)" : ""}`);

  let created = 0;
  for (const e of events) {
    if (dryRun) {
      console.log(`  ${e.id}  →  ${await generateUniqueSlug(e.title)}`);
      continue;
    }
    const page = await eventPageService.ensurePageForEvent(e.id, e.title);
    console.log(`  ${e.id}  →  ${page.slug}`);
    created++;
  }
  console.log(`[backfill] terminé : ${created} page(s) créée(s)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
