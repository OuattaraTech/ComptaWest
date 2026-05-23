-- ============================================================================
-- MIGRATION 028 : comptes démo isolés et expirables
-- ============================================================================
-- Avant cette migration, l'unique compte demo@comptawest.ci était partagé
-- entre tous les visiteurs du site — risque RGPD (vrais NCC/RIB visibles
-- par les autres) et expérience cassée (factures qui apparaissent toutes
-- seules quand un autre visiteur teste).
--
-- Refonte : chaque clic sur « Tester en mode démo » crée maintenant un
-- compte temporaire isolé avec son propre user + entreprise + données
-- pré-remplies. Les comptes expirent automatiquement après 24 h.
--
-- Cleanup : un cron applicatif (node-cron) tourne toutes les heures et
-- supprime les comptes démo expirés. Les entreprises liées tombent en
-- CASCADE (déjà configuré), puis les utilisateurs.
--
-- À exécuter sur les bases existantes :
--   psql -U <user> -d comptawest -f config/migrations/028_demo_users_isolated.sql
-- ============================================================================

BEGIN;

-- Drapeau is_demo + horodatage d'expiration sur utilisateurs
ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS is_demo         BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMP;

COMMENT ON COLUMN utilisateurs.is_demo IS
  'TRUE pour les comptes démo auto-générés (expirables après 24 h). '
  'Sert à afficher le bandeau d''expiration et à cibler le cron de cleanup.';
COMMENT ON COLUMN utilisateurs.demo_expires_at IS
  'Horodatage d''expiration du compte démo. NULL pour les comptes permanents. '
  'Index partiel pour accélérer le SELECT du cron de nettoyage.';

-- Index partiel : on n'indexe QUE les comptes démo (les permanents sont
-- > 99 % des lignes en prod et n'ont pas besoin de cet index)
CREATE INDEX IF NOT EXISTS idx_utilisateurs_demo_expires
  ON utilisateurs (demo_expires_at)
  WHERE is_demo = TRUE;

-- Drapeau is_demo sur entreprises aussi (utile pour les rapports admin
-- « combien de comptes démo créés ce mois ? » sans avoir à joindre les
-- utilisateurs).
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN entreprises.is_demo IS
  'TRUE pour les entreprises créées dans le cadre d''un compte démo. '
  'Tombent en CASCADE quand l''utilisateur démo associé est supprimé.';

-- Migration de l'ancien compte démo unique → désactivé pour éviter qu'il
-- continue d'être réutilisé. Les nouveaux visiteurs auront leur propre
-- compte isolé via la route /auth/demo refondée.
UPDATE utilisateurs
   SET actif = FALSE,
       email = 'demo-legacy-' || extract(epoch from now())::bigint || '@deprecated.local'
 WHERE email = 'demo@comptawest.ci'
   AND is_demo = FALSE;

COMMIT;
