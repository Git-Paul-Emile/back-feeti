#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Contrôle de dérive schéma Prisma ↔ base de données (hors-ligne, sans moteur).
 *
 * Compare les modèles/enums déclarés dans schema.prisma à l'état réel de la base
 * pointée par DATABASE_URL, et signale :
 *   - les tables du schéma absentes de la base ;
 *   - les colonnes déclarées mais absentes ;
 *   - les enums absents ou avec des valeurs manquantes.
 *
 * C'est exactement le type de contrôle qui aurait détecté les 3 bugs de dérive
 * corrigés en juillet 2026. À lancer après `prisma migrate deploy` sur une base
 * neuve, en local avant un push ou dans un hook.
 *
 * Usage :
 *   DATABASE_URL=postgres://... node scripts/check-schema-drift.mjs [chemin_schema]
 * Sortie : code 0 si aucune dérive, code 1 sinon.
 *
 * Dépendance : le paquet `pg` (déjà présent via @prisma/adapter-pg, sinon `npm i pg`).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const schemaPath = process.argv[2] || 'prisma/schema.prisma';
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('✗ DATABASE_URL non défini.');
  process.exit(1);
}

const schema = readFileSync(schemaPath, 'utf8');

// ── Extraction des modèles (nom de table effective via @@map) et de leurs colonnes
const models = {};
for (const m of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
  const name = m[1];
  const body = m[2];
  const map = body.match(/@@map\("([^"]+)"\)/);
  const table = map ? map[1] : name;
  const cols = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
    const f = line.match(/^(\w+)\s+(\w+)(\[\])?/);
    if (!f) continue;
    const [, fname, ftype, isList] = f;
    if (isList) continue;                                  // relation 1-N : pas de colonne
    if (/@relation\(/.test(line) && /fields:/.test(line)) continue; // objet relation
    if (/@relation/.test(line) && !/fields:/.test(line)) continue;
    if (schema.includes('model ' + ftype + ' {')) continue; // type = modèle → relation
    cols.push(fname);
  }
  models[table] = cols;
}

// ── Extraction des enums
const enums = {};
for (const em of schema.matchAll(/^enum (\w+) \{([\s\S]*?)^\}/gm)) {
  enums[em[1]] = em[2]
    .split('\n')
    .map((s) => s.trim().replace(/\/\/.*$/, '').trim())
    .filter((s) => s && !s.startsWith('@@'));
}

const client = new Client({ connectionString: dbUrl });
await client.connect();

const problems = [];

for (const [ename, vals] of Object.entries(enums)) {
  const r = await client.query(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = $1`,
    [ename],
  );
  const have = r.rows.map((x) => x.enumlabel);
  if (!have.length) problems.push(`ENUM ${ename} : absent de la base`);
  else {
    const missing = vals.filter((v) => !have.includes(v));
    if (missing.length) problems.push(`ENUM ${ename} : valeurs manquantes → ${missing.join(', ')}`);
  }
}

for (const [table, cols] of Object.entries(models)) {
  const r = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [table],
  );
  const have = r.rows.map((x) => x.column_name);
  if (!have.length) { problems.push(`TABLE ${table} : absente`); continue; }
  const missing = cols.filter((c) => !have.includes(c));
  if (missing.length) problems.push(`TABLE ${table} : colonnes manquantes → ${missing.join(', ')}`);
}

await client.end();

if (problems.length) {
  console.error(`✗ Dérive détectée (${problems.length}) :`);
  for (const p of problems) console.error('   - ' + p);
  process.exit(1);
}
console.log('✓ Aucune dérive : schéma Prisma et base alignés.');
