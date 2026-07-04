-- =====================================================
-- MediDoc - Migration 004 : Annulation d'un envoi par le technicien/responsable de labo
-- =====================================================
BEGIN;

ALTER TABLE medical_results DROP CONSTRAINT IF EXISTS medical_results_status_check;
ALTER TABLE medical_results ADD CONSTRAINT medical_results_status_check
  CHECK (status IN ('pending', 'sent', 'delivered', 'accessed', 'expired', 'locked', 'cancelled'));

ALTER TABLE medical_results ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(id);
ALTER TABLE medical_results ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

COMMIT;
