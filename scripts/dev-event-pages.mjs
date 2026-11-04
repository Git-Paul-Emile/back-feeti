// Lance le back en local pour tester les pages événement, sur la base locale
// feeti2_pages (copie de feeti2) : ni la base feeti2 locale ni Supabase ne sont touchées.
// Les variables déjà présentes dans l'environnement priment (dotenv n'écrase pas).
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Toujours exécuter depuis FeetiTicketWeb/back, quel que soit le dossier courant
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

const LOCAL_DB = process.env.PAGES_DATABASE_URL || "postgresql://postgres@localhost:5432/feeti2_pages";

const env = {
  ...process.env,
  DATABASE_URL: LOCAL_DB,
  DIRECT_URL: LOCAL_DB,
  // Base de test locale : ne rien recopier dans le Firestore réel du .env
  FIRESTORE_SYNC_ENABLED: "false",
  PORT: process.env.PORT || "8010",
  FRONT_URL: process.env.FRONT_URL || "http://localhost:3005",
  EVENT_PAGES_ROOT_DOMAIN: process.env.EVENT_PAGES_ROOT_DOMAIN || "feeti.io",
  EVENT_PAGES_URL_TEMPLATE: process.env.EVENT_PAGES_URL_TEMPLATE || "http://{slug}.localhost:3100",
};

// node --import tsx (pas de npx/shell : « npx tsx watch » reste bloqué sous Windows)
const child = spawn(process.execPath, ["--import", "tsx", "--watch", "src/index.ts"], { env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
