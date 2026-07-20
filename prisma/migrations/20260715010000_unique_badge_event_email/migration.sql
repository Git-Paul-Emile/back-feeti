-- Empêche deux badges pour le même (eventId, holderEmail). NULL n'est jamais
-- égal à NULL en SQL, donc les badges indépendants (eventId NULL) ne sont
-- pas concernés par cette contrainte.
-- Note : la contrainte porte sur l'email tel que stocké, pas sur sa forme
-- normalisée (voir normalizeBadgeEmail côté application) — deux emails
-- équivalents mais orthographiés différemment (casse/espaces) ne sont donc
-- pas bloqués par ce filet de sécurité DB.

CREATE UNIQUE INDEX IF NOT EXISTS "AccessBadge_eventId_holderEmail_key"
  ON "AccessBadge"("eventId", "holderEmail");
