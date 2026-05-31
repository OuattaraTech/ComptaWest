-- Migration 041 — Réinitialisation de mot de passe (« mot de passe oublié »).
--
-- Ajoute à `utilisateurs` un jeton de réinitialisation à usage unique et son
-- expiration. On stocke le HACHÉ du jeton (SHA-256), jamais le jeton en clair :
-- une fuite de la base ne permettrait pas de réinitialiser un compte.
--
-- Flux :
--   1. POST /auth/forgot-password { email } → génère un jeton aléatoire,
--      stocke son SHA-256 + expiration (1 h), envoie le lien par email.
--   2. POST /auth/reset-password { token, mot_de_passe } → vérifie le haché
--      et l'expiration, met à jour le mot de passe, efface le jeton.

BEGIN;

ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS reset_token_hash   VARCHAR(64),
  ADD COLUMN IF NOT EXISTS reset_token_expire TIMESTAMP;

-- Recherche par jeton lors de la réinitialisation.
CREATE INDEX IF NOT EXISTS idx_utilisateurs_reset_token
  ON utilisateurs (reset_token_hash) WHERE reset_token_hash IS NOT NULL;

COMMIT;
