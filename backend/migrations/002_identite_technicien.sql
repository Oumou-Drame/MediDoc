-- =====================================================
-- MediDoc - Migration 002 : Prénom / Nom séparés + date de naissance
-- =====================================================
-- À exécuter une seule fois, après 001_multi_hospital.sql.
-- Idempotent : peut être relancée sans casser une base déjà migrée.

BEGIN;

-- ---------------------------------------------------------
-- 1. Nouveaux champs d'identité sur users
-- ---------------------------------------------------------
-- full_name reste la colonne "d'affichage" utilisée partout dans l'app
-- (elle continue d'exister et est recalculée à chaque création/modification
-- d'un compte à partir de first_name + last_name).
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_naissance DATE;

-- ---------------------------------------------------------
-- 2. Backfill : on déduit prénom/nom des comptes existants à partir de full_name
-- (best effort : premier mot = prénom, reste = nom). date_naissance reste NULL
-- pour les comptes déjà créés, à compléter au besoin depuis "Modifier".
-- ---------------------------------------------------------
UPDATE users
SET
  first_name = COALESCE(NULLIF(split_part(full_name, ' ', 1), ''), full_name),
  last_name = NULLIF(trim(substring(full_name from length(split_part(full_name, ' ', 1)) + 1)), '')
WHERE first_name IS NULL AND full_name IS NOT NULL;

COMMIT;
