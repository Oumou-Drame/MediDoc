-- =====================================================
-- MediDoc - Export SQL PostgreSQL
-- Plateforme de Protection et d'envoi sécurisé de résultats médicaux
-- ========================================================

-- Création des tables
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK(role IN ('admin', 'technician')),
  phone VARCHAR(50),
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medical_results (
  id SERIAL PRIMARY KEY,
  technician_id INTEGER NOT NULL REFERENCES users(id),
  patient_name VARCHAR(255) NOT NULL,
  patient_phone VARCHAR(50) NOT NULL,
  patient_email VARCHAR(255),
  original_filename TEXT NOT NULL,
  protected_filename TEXT NOT NULL,
  access_code VARCHAR(10) NOT NULL,
  access_token VARCHAR(64) NOT NULL,
  channel VARCHAR(50) NOT NULL CHECK(channel IN ('email_whatsapp', 'email_sms')),
  status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'accessed', 'expired', 'locked')),
  whatsapp_sent INTEGER DEFAULT 0,
  sms_sent INTEGER DEFAULT 0,
  email_sent INTEGER DEFAULT 0,
  code_accessed INTEGER DEFAULT 0,
  access_count INTEGER DEFAULT 0,
  attempt_count INTEGER DEFAULT 0,
  is_locked INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  accessed_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  details TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration: Restreindre les canaux aux seuls modes autorisés
-- Exécuter seulement si la contrainte existe déjà avec d'anciens valores
DO $$
BEGIN
  -- Supprimer l'ancienne contrainte si elle existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname LIKE '%channel%' 
    AND conrelid = 'medical_results'::regclass
  ) THEN
    ALTER TABLE medical_results DROP CONSTRAINT IF EXISTS medical_results_channel_check;
    ALTER TABLE medical_results ADD CONSTRAINT medical_results_channel_check 
      CHECK(channel IN ('email_whatsapp', 'email_sms'));
  END IF;
END $$;

-- Paramètres par défaut (idempotent, quel que soit l'état des contraintes
-- d'unicité de la table settings au moment de l'exécution)
INSERT INTO settings (setting_key, setting_value)
SELECT v.k, v.val
FROM (VALUES
  ('whatsapp_enabled', 'true'),
  ('sms_enabled', 'true'),
  ('email_enabled', 'true'),
  ('code_expiration_hours', '48'),
  ('max_file_size_mb', '50')
) AS v(k, val)
WHERE NOT EXISTS (
  SELECT 1 FROM settings s WHERE s.setting_key = v.k
);
