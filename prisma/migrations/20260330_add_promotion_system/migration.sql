-- Migration: Système de mise en avant par catégorie (packs promotionnels)

-- Champs promotion événements (Pack OR / ARGENT / BRONZE / LITE)
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "promotionType"      TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "promotionStatus"    TEXT DEFAULT 'inactive';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "promotionStartDate" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "promotionEndDate"   TIMESTAMP(3);

-- Champs promotion loisirs (Offre BASIC / PRO / PREMIUM + Packs ponctuels)
ALTER TABLE "LeisureItem" ADD COLUMN IF NOT EXISTS "leisureOfferType"     TEXT;
ALTER TABLE "LeisureItem" ADD COLUMN IF NOT EXISTS "leisurePackType"      TEXT;
ALTER TABLE "LeisureItem" ADD COLUMN IF NOT EXISTS "leisurePackStatus"    TEXT DEFAULT 'inactive';
ALTER TABLE "LeisureItem" ADD COLUMN IF NOT EXISTS "leisurePackStartDate" TIMESTAMP(3);
ALTER TABLE "LeisureItem" ADD COLUMN IF NOT EXISTS "leisurePackEndDate"   TIMESTAMP(3);
