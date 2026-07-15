-- ─────────────────────────────────────────────────────────────────────────────
-- Ajout des valeurs d'enum manquantes (isolé des autres DDL).
--
-- Deux valeurs déclarées dans schema.prisma et utilisées par le code n'avaient
-- jamais été ajoutées aux enums en base par les migrations :
--   • Role.establishment_owner  → connexion des propriétaires d'établissement.
--   • LedgerOperationType.promotion_deduction → écriture de grand livre créée
--     par transaction.service.ts lors d'une déduction du coût de promotion sur
--     les ventes (mode on_sales). Sans elle, l'INSERT dans WalletLedger échoue.
--
-- Les ajouts d'enum sont volontairement isolés dans leur propre migration :
-- PostgreSQL interdit d'utiliser une valeur d'enum dans la même transaction que
-- son ALTER TYPE ... ADD VALUE. Idempotent (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'establishment_owner';

ALTER TYPE "LedgerOperationType" ADD VALUE IF NOT EXISTS 'promotion_deduction';
