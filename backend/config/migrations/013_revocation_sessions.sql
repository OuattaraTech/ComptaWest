-- ============================================================================
-- MIGRATION 013 : RÉVOCATION DES SESSIONS
-- ============================================================================
-- Objectif : pouvoir invalider immédiatement les jetons JWT d'un utilisateur,
-- sans attendre leur expiration (7 jours par défaut).
--
-- Mécanisme :
--   - tokens_invalides_avant : tout JWT émis (iat) AVANT cet horodatage est
--     refusé par le middleware d'authentification.
--   - Pour déconnecter un utilisateur partout (changement de mot de passe,
--     compromission, départ) : UPDATE utilisateurs SET tokens_invalides_avant = NOW().
--   - Le middleware auth.js vérifie également, à chaque requête, que le compte
--     est toujours actif (actif = true) — un compte désactivé perd l'accès
--     immédiatement et non à l'expiration du jeton.
-- ============================================================================

ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS tokens_invalides_avant TIMESTAMP;

COMMENT ON COLUMN utilisateurs.tokens_invalides_avant IS
  'Tout JWT émis avant cet horodatage est rejeté. NULL = aucune révocation.';
