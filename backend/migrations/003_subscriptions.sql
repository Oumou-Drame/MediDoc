-- ===========================================================
-- Migration 003 : Système d'abonnements par packs
-- ===========================================================

-- Table des packs d'abonnement
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',
    duration_days INTEGER NOT NULL DEFAULT 30,
    features JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des abonnements des hôpitaux
CREATE TABLE IF NOT EXISTS hospital_subscriptions (
    id SERIAL PRIMARY KEY,
    hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    transaction_id VARCHAR(255),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    trial_end_date TIMESTAMP,
    chosen_at TIMESTAMP DEFAULT NOW(),
    validated_by INTEGER REFERENCES users(id),
    validated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Ajout du champ has_chosen_plan sur users
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_chosen_plan BOOLEAN NOT NULL DEFAULT false;

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_hospital_subscriptions_hospital ON hospital_subscriptions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_subscriptions_status ON hospital_subscriptions(status);

-- ===========================================================
-- Seed : Packs par défaut
-- ===========================================================
INSERT INTO subscription_plans (name, description, price, currency, duration_days, features, sort_order, is_active)
VALUES
(
    'Essentiel',
    'Pour les petits laboratoires souhaitant démarrer avec l''essentiel. Accès aux fonctionnalités de base pour un nombre limité de techniciens.',
    0,
    'XOF',
    30,
    '{
        "max_technicians": 2,
        "whatsapp": false,
        "email": true,
        "sms": false,
        "monthly_sends": 50,
        "statistics": "basic",
        "history_days": 30,
        "support": "standard",
        "api_access": false
    }'::jsonb,
    1,
    true
),
(
    'Standard',
    'Idéal pour les laboratoires en croissance. Envoi WhatsApp, techniciens illimités et statistiques avancées.',
    50000,
    'XOF',
    30,
    '{
        "max_technicians": 10,
        "whatsapp": true,
        "email": true,
        "sms": false,
        "monthly_sends": -1,
        "statistics": "advanced",
        "history_days": 365,
        "support": "priority",
        "api_access": false
    }'::jsonb,
    2,
    true
),
(
    'Premium',
    'Pour les grands établissements. Tout débloqué : SMS, API, support dédié 24/7, historique illimité.',
    100000,
    'XOF',
    30,
    '{
        "max_technicians": -1,
        "whatsapp": true,
        "email": true,
        "sms": true,
        "monthly_sends": -1,
        "statistics": "realtime",
        "history_days": -1,
        "support": "dedicated",
        "api_access": true
    }'::jsonb,
    3,
    true
)
ON CONFLICT DO NOTHING;