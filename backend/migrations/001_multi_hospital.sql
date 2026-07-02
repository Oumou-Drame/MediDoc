-- =====================================================
-- MediDoc - Migration 001 : Architecture multi-hôpitaux
-- Voir Récapitulatif de cadrage (refonte multi-hôpitaux, rôles, profils, design)
-- =====================================================
-- À exécuter une seule fois sur la base existante (schéma initial : Archives/medidoc.sql).
-- Idempotent : peut être relancée sans casser une base déjà migrée.

BEGIN;

-- ---------------------------------------------------------
-- 1. Hôpitaux / laboratoires (établissements)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 2. Demandes d'inscription d'hôpitaux (landing page / formulaire public)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospital_requests (
  id SERIAL PRIMARY KEY,
  hospital_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by INTEGER,
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  created_hospital_id INTEGER REFERENCES hospitals(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 3. users : rattachement à un hôpital + nouveau rôle + cumul de rôles
-- ---------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id);

-- Un responsable de labo peut aussi cumuler la capacité technicien (switch de vue mémorisé)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_technician BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_view VARCHAR(20) CHECK (active_view IN ('lab_manager', 'technician'));

-- Premier mot de passe imposé (auto-généré) à changer à la première connexion
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Connexion par email : username devient optionnel puis sera retiré dans une migration ultérieure
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;

-- Nouveau rôle 'lab_manager', 'admin' devient un rôle plateforme sans hôpital
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'lab_manager', 'technician'));

-- NB: la contrainte "un admin plateforme n'a pas de hospital_id, un lab_manager/technician en a un"
-- est ajoutée plus bas (section 9), une fois le backfill des données existantes effectué —
-- sinon elle échouerait immédiatement sur les techniciens déjà en base (hospital_id encore NULL).

-- ---------------------------------------------------------
-- 4. medical_results : rattachement à un hôpital
-- ---------------------------------------------------------
ALTER TABLE medical_results ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id);

-- ---------------------------------------------------------
-- 5. settings : devient potentiellement spécifique à un hôpital (NULL = plateforme)
-- ---------------------------------------------------------
ALTER TABLE settings ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id);
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_setting_key_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'settings_key_hospital_unique'
  ) THEN
    CREATE UNIQUE INDEX settings_key_hospital_unique ON settings (setting_key, COALESCE(hospital_id, 0));
  END IF;
END $$;

-- ---------------------------------------------------------
-- 6. Configuration d'envoi propre à chaque hôpital
--    (email SMTP + numéro d'envoi SMS/WhatsApp déjà activé côté plateforme)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospital_send_config (
  hospital_id INTEGER PRIMARY KEY REFERENCES hospitals(id) ON DELETE CASCADE,
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_user VARCHAR(255),
  smtp_pass VARCHAR(255),
  smtp_from_name VARCHAR(255),
  sms_whatsapp_sender VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- NB: smtp_pass est stocké en clair pour cette phase (cohérent avec le reste du projet,
-- aucun secret chiffré n'existe encore ailleurs). À chiffrer lors de l'audit sécurité.

-- ---------------------------------------------------------
-- 7. Système de crédits SMS/WhatsApp par hôpital
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospital_credits (
  hospital_id INTEGER PRIMARY KEY REFERENCES hospitals(id) ON DELETE CASCADE,
  balance NUMERIC(12,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hospital_credit_transactions (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('recharge', 'deduction', 'adjustment')),
  amount NUMERIC(12,4) NOT NULL,
  balance_after NUMERIC(12,4) NOT NULL,
  related_result_id INTEGER REFERENCES medical_results(id),
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 8. Mot de passe oublié (lien à durée limitée)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 9. Backfill : création d'un hôpital par défaut pour les données existantes
--    et rattachement de tout ce qui existait avant la refonte.
--    L'ancien rôle 'admin' (qui gérait en réalité un seul hôpital) devient 'lab_manager'.
--    Le vrai admin plateforme (sans accès patients) doit être créé séparément
--    via backend/scripts/create-platform-admin.js après cette migration.
-- ---------------------------------------------------------
INSERT INTO hospitals (name, status)
SELECT 'Hôpital par défaut (migration)', 'active'
WHERE NOT EXISTS (SELECT 1 FROM hospitals);

DO $$
DECLARE
  default_hospital_id INTEGER;
BEGIN
  SELECT id INTO default_hospital_id FROM hospitals ORDER BY id LIMIT 1;

  UPDATE users
  SET role = 'lab_manager', hospital_id = default_hospital_id
  WHERE role = 'admin' AND hospital_id IS NULL;

  UPDATE users
  SET hospital_id = default_hospital_id
  WHERE role = 'technician' AND hospital_id IS NULL;

  UPDATE medical_results mr
  SET hospital_id = default_hospital_id
  WHERE mr.hospital_id IS NULL;

  INSERT INTO hospital_credits (hospital_id, balance)
  SELECT default_hospital_id, 0
  WHERE NOT EXISTS (SELECT 1 FROM hospital_credits WHERE hospital_id = default_hospital_id);
END $$;

-- hospital_id devient obligatoire sur medical_results une fois le backfill effectué
ALTER TABLE medical_results ALTER COLUMN hospital_id SET NOT NULL;

-- Un admin plateforme n'est rattaché à aucun hôpital ; un lab_manager/technician doit l'être
-- (ajoutée ici, après le backfill, pour ne pas échouer sur les lignes déjà existantes)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_hospital_scope_check;
ALTER TABLE users ADD CONSTRAINT users_hospital_scope_check CHECK (
  (role = 'admin' AND hospital_id IS NULL) OR
  (role IN ('lab_manager', 'technician') AND hospital_id IS NOT NULL)
);

COMMIT;
