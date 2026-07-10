-- ===========================================================
-- Migration 008 : Numéro d'agrément sur hospitals + note sur le schéma réel
-- ===========================================================
-- Ajoute numero_agrement sur hospitals (copié depuis hospital_requests à l'approbation),
-- pour permettre une vérification de doublon fiable, indépendante du texte saisi comme
-- nom d'établissement (ex: sigle "HOGYP" vs nom complet "Hôpital Général Idrissa Pouye").
--
-- NB schéma : la table hospitals utilise bien les colonnes email / phone / status
-- (définies dans 001_multi_hospital.sql), pas contact_email / contact_phone / is_active.
-- Le code de backend/routes/hospital-route.js a été corrigé pour utiliser les bonnes colonnes
-- (il utilisait par erreur des noms qui n'existent pas — voir remarque dans le fichier).

ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS numero_agrement VARCHAR(100);
