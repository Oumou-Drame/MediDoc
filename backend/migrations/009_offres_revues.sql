-- ===========================================================
-- Migration 009 : Révision des offres d'abonnement
-- ===========================================================
-- Décision produit (juillet 2026) : plus de palier gratuit, et les quotas sont
-- calibrés sur un volume combiné SMS + WhatsApp mensuel (email toujours illimité,
-- coût marginal quasi nul). Tarifs basés sur un coût réel estimé de ~15-25 FCFA
-- par envoi SMS/WhatsApp (Africa's Talking pour le SMS, largement moins cher que
-- Twilio sur le Sénégal), donc une bonne marge est conservée sur chaque palier.

UPDATE subscription_plans SET
    description = 'Pour les petites structures qui démarrent. Email, SMS et WhatsApp inclus, avec un quota mensuel adapté à un faible volume.',
    price = 20000,
    features = '{
        "max_technicians": 2,
        "whatsapp": true,
        "email": true,
        "sms": true,
        "monthly_sends": 200,
        "statistics": "basic",
        "history_days": 90,
        "support": "standard",
        "api_access": false
    }'::jsonb,
    updated_at = NOW()
WHERE name = 'Essentiel';

UPDATE subscription_plans SET
    description = 'Idéal pour les structures en croissance. Quota mensuel confortable, historique 1 an et support prioritaire.',
    price = 50000,
    features = '{
        "max_technicians": 8,
        "whatsapp": true,
        "email": true,
        "sms": true,
        "monthly_sends": 700,
        "statistics": "advanced",
        "history_days": 365,
        "support": "priority",
        "api_access": false
    }'::jsonb,
    updated_at = NOW()
WHERE name = 'Standard';

UPDATE subscription_plans SET
    description = 'Pour les grands établissements. Techniciens illimités, gros volume d''envois, historique illimité, support dédié et accès API.',
    price = 100000,
    features = '{
        "max_technicians": -1,
        "whatsapp": true,
        "email": true,
        "sms": true,
        "monthly_sends": 2000,
        "statistics": "realtime",
        "history_days": -1,
        "support": "dedicated",
        "api_access": true
    }'::jsonb,
    updated_at = NOW()
WHERE name = 'Premium';

-- Si les 3 plans n'existaient pas encore (base jamais migrée avec 003_subscriptions.sql),
-- on les insère directement avec les nouvelles valeurs.
INSERT INTO subscription_plans (name, description, price, currency, duration_days, features, sort_order, is_active)
SELECT 'Essentiel', 'Pour les petites structures qui démarrent. Email, SMS et WhatsApp inclus, avec un quota mensuel adapté à un faible volume.',
    20000, 'XOF', 30,
    '{"max_technicians":2,"whatsapp":true,"email":true,"sms":true,"monthly_sends":200,"statistics":"basic","history_days":90,"support":"standard","api_access":false}'::jsonb,
    1, true
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Essentiel');

INSERT INTO subscription_plans (name, description, price, currency, duration_days, features, sort_order, is_active)
SELECT 'Standard', 'Idéal pour les structures en croissance. Quota mensuel confortable, historique 1 an et support prioritaire.',
    50000, 'XOF', 30,
    '{"max_technicians":8,"whatsapp":true,"email":true,"sms":true,"monthly_sends":700,"statistics":"advanced","history_days":365,"support":"priority","api_access":false}'::jsonb,
    2, true
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Standard');

INSERT INTO subscription_plans (name, description, price, currency, duration_days, features, sort_order, is_active)
SELECT 'Premium', 'Pour les grands établissements. Techniciens illimités, gros volume d''envois, historique illimité, support dédié et accès API.',
    100000, 'XOF', 30,
    '{"max_technicians":-1,"whatsapp":true,"email":true,"sms":true,"monthly_sends":2000,"statistics":"realtime","history_days":-1,"support":"dedicated","api_access":true}'::jsonb,
    3, true
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Premium');
