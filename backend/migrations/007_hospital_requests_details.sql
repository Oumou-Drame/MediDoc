-- ===========================================================
-- Migration 007 : Détails d'inscription séparés sur hospital_requests
-- ===========================================================
-- Avant cette migration, l'adresse et le n° d'agrément saisis dans le formulaire
-- d'inscription étaient concaténés dans la colonne "message" (texte libre).
-- Pour permettre un affichage propre de la fiche de demande (page admin "Demandes
-- d'inscription"), on les stocke maintenant dans leurs propres colonnes.

ALTER TABLE hospital_requests ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE hospital_requests ADD COLUMN IF NOT EXISTS numero_agrement VARCHAR(100);
