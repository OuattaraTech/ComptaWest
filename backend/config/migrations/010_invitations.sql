-- ============================================================================
-- MIGRATION 010 : LIENS D'INVITATION DES MEMBRES
-- ============================================================================
-- Objectif : permettre à un utilisateur invité (nouvel email) de définir
-- lui-même son mot de passe via un lien unique, puis d'accéder à l'app.
--
-- Mécanisme :
--   - inviterMembre crée un compte avec actif = false + un invitation_token
--   - le login filtre déjà sur actif = true → un compte non activé ne peut
--     pas se connecter
--   - l'invité ouvre /invitation/<token>, définit son mot de passe → le
--     compte passe actif = true, le token est consommé
-- ============================================================================

ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(100),
  ADD COLUMN IF NOT EXISTS invitation_expire_at TIMESTAMP;

-- Recherche rapide par token (et unicité)
CREATE UNIQUE INDEX IF NOT EXISTS idx_utilisateurs_invitation_token
  ON utilisateurs(invitation_token) WHERE invitation_token IS NOT NULL;

COMMENT ON COLUMN utilisateurs.invitation_token IS
  'Jeton à usage unique pour l''activation d''un compte invité. NULL une fois consommé.';
COMMENT ON COLUMN utilisateurs.invitation_expire_at IS
  'Date d''expiration du lien d''invitation (7 jours après l''envoi).';
