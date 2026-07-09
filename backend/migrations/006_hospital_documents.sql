-- ===========================================================
-- Migration 006 : Table des documents de vérification d'hôpital
-- ===========================================================

-- Table des documents de vérification
CREATE TABLE IF NOT EXISTS hospital_documents (
    id SERIAL PRIMARY KEY,
    hospital_request_id INTEGER NOT NULL REFERENCES hospital_requests(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('agreement', 'license', 'registration', 'other')),
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    upload_date TIMESTAMP DEFAULT NOW(),
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verified_by INTEGER REFERENCES users(id),
    verified_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Ajout de champ document_status dans hospital_requests
ALTER TABLE hospital_requests ADD COLUMN IF NOT EXISTS document_status VARCHAR(20) DEFAULT 'not_required' 
CHECK (document_status IN ('not_required', 'pending', 'verified', 'rejected'));

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_hospital_documents_request ON hospital_documents(hospital_request_id);
CREATE INDEX IF NOT EXISTS idx_hospital_documents_status ON hospital_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_hospital_requests_document_status ON hospital_requests(document_status);
