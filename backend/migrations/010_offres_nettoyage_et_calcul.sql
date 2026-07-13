-- ===========================================================
-- Migration 010 : Nettoyage des offres en double + prix calculés au coût réel
-- ===========================================================
-- La migration 009 mettait à jour par nom exact ('Essentiel'/'Standard'/'Premium'),
-- ce qui a laissé d'anciens plans (dont l'ancien "Essentiel" gratuit) non reconnus
-- à côté des nouveaux — d'où les 6 offres au lieu de 3.
--
-- Cette migration : supprime tous les plans non liés à un abonnement d'hôpital réel
-- (donc sans risque de casser une souscription existante), puis réinsère exactement
-- 3 offres, plus aucune gratuite.
--
-- Calcul du prix = (quota mensuel SMS+WhatsApp inclus × coût unitaire estimé) + 20 000 FCFA de marge.
-- Coût unitaire retenu : 20 FCFA/envoi (moyenne SMS via Africa's Talking, ~11 à 29 FCFA selon
-- palier de recharge, + WhatsApp estimé ~15-20 FCFA). Email illimité, coût marginal nul.
--   Essentiel : 200 envois x 20 FCFA = 4 000 + 20 000  = 24 000 FCFA
--   Standard  : 700 envois x 20 FCFA = 14 000 + 20 000 = 34 000 FCFA
--   Premium   : 2000 envois x 20 FCFA = 40 000 + 20 000 = 60 000 FCFA

-- Supprime tout plan qui n'est utilisé par aucun abonnement d'hôpital existant.
DELETE FROM subscription_plans
WHERE id NOT IN (
    SELECT DISTINCT plan_id FROM hospital_subscriptions
);

-- Réinsère les 3 offres avec les prix recalculés (si elles n'existent pas déjà après le nettoyage).
INSERT INTO subscription_plans (name, description, price, currency, duration_days, features, sort_order, is_active)
SELECT 'Essentiel',
    'Pour les petites structures qui démarrent. Email, SMS et WhatsApp inclus, avec un quota mensuel adapté à un faible volume.',
    24000, 'XOF', 30,
    '{"max_technicians":2,"whatsapp":true,"email":true,"sms":true,"monthly_sends":200,"statistics":"basic","history_days":90,"support":"standard","api_access":false}'::jsonb,
    1, true
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Essentiel');

INSERT INTO subscription_plans (name, description, price, currency, duration_days, features, sort_order, is_active)
SELECT 'Standard',
    'Idéal pour les structures en croissance. Quota mensuel confortable, historique 1 an et support prioritaire.',
    34000, 'XOF', 30,
    '{"max_technicians":8,"whatsapp":true,"email":true,"sms":true,"monthly_sends":700,"statistics":"advanced","history_days":365,"support":"priority","api_access":false}'::jsonb,
    2, true
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Standard');

INSERT INTO subscription_plans (name, description, price, currency, duration_days, features, sort_order, is_active)
SELECT 'Premium',
    'Pour les grands établissements. Techniciens illimités, gros volume d''envois, historique illimité, support dédié et accès API.',
    60000, 'XOF', 30,
    '{"max_technicians":-1,"whatsapp":true,"email":true,"sms":true,"monthly_sends":2000,"statistics":"realtime","history_days":-1,"support":"dedicated","api_access":true}'::jsonb,
    3, true
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Premium');

-- Si les 3 plans existaient déjà (survivants du nettoyage, ex: liés à un abonnement réel),
-- on force quand même leurs prix/quotas aux nouvelles valeurs calculées.
UPDATE subscription_plans SET price = 24000, features = features || '{"monthly_sends":200}'::jsonb, updated_at = NOW() WHERE name = 'Essentiel';
UPDATE subscription_plans SET price = 34000, features = features || '{"monthly_sends":700}'::jsonb, updated_at = NOW() WHERE name = 'Standard';
UPDATE subscription_plans SET price = 60000, features = features || '{"monthly_sends":2000}'::jsonb, updated_at = NOW() WHERE name = 'Premium';
