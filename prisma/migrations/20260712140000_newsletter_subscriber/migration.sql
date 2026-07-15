-- Newsletter : inscrits via le formulaire du footer (visiteurs sans compte inclus)
-- Utilisé par la campagne hebdomadaire "Les Fééties de la semaine"

CREATE TABLE IF NOT EXISTS "NewsletterSubscriber" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email"            TEXT NOT NULL UNIQUE,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "unsubscribeToken" TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  "source"           TEXT NOT NULL DEFAULT 'footer',
  "subscribedAt"     TIMESTAMP NOT NULL DEFAULT now(),
  "unsubscribedAt"   TIMESTAMP,
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "NewsletterSubscriber_isActive_idx" ON "NewsletterSubscriber"("isActive");
