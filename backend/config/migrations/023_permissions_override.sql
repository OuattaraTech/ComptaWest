-- ============================================================================
-- MIGRATION 023 : PERMISSIONS PERSONNALISÉES PAR MEMBRE
-- ============================================================================
-- Objectif : permettre au Propriétaire / Admin de surcharger la matrice de
-- permissions par défaut associée à un rôle, membre par membre. Le rôle
-- continue de servir de « template » à la création (champ pré-rempli),
-- mais le Propriétaire peut cocher/décocher chaque action de chaque module
-- pour ce membre précis. Si la colonne `permissions_override` est NULL,
-- on retombe sur la matrice statique de backend/src/utils/permissions.js
-- (comportement historique inchangé pour les membres existants).
--
-- Format du JSONB attendu :
--   {
--     "factures":     ["read", "create", "update"],
--     "depenses":     ["read"],
--     "comptabilite": ["read", "create", "update", "counter_pass"]
--   }
--
-- Un module absent du JSONB signifie « aucune action autorisée sur ce
-- module pour ce membre ». Un tableau vide a la même sémantique. La
-- validation et la fusion sont assurées côté Node (permissions.js +
-- authController.getMesPermissions).
-- ============================================================================

ALTER TABLE membres_entreprise
  ADD COLUMN IF NOT EXISTS permissions_override JSONB DEFAULT NULL;

COMMENT ON COLUMN membres_entreprise.permissions_override IS
  'Surcharge des permissions par défaut du rôle (NULL = matrice standard '
  'ApeX, JSONB = permissions personnalisées). Format : { module: [actions] }. '
  'Géré par backend/src/utils/permissions.js (peutAvecOverride).';

-- Index GIN pour requêter rapidement « membres ayant un override actif »
-- (utile pour l'admin qui veut auditer les configurations personnalisées).
CREATE INDEX IF NOT EXISTS idx_membres_override
  ON membres_entreprise USING GIN (permissions_override)
  WHERE permissions_override IS NOT NULL;
