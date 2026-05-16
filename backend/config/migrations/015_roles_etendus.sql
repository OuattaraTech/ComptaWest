-- ============================================================================
-- MIGRATION 015 : 4 NOUVEAUX RÔLES MÉTIER (expert_comptable, commercial,
--                 magasinier, auditeur)
-- ============================================================================
-- Objectif : passer de 6 à 10 rôles enum pour refléter la séparation des
-- fonctions attendue dans une PME ivoirienne sous SYSCOHADA.
--
-- Nouveaux rôles ajoutés :
--   - expert_comptable  : cabinet externe agréé ONECCA. CRUD écritures et
--                         exclusivité sur clôture d'exercice + liasse DSF.
--   - commercial        : émission de devis/proformas/factures ; lecture
--                         seule sur le catalogue produits ; aucun accès
--                         aux prix d'achat (filtrage côté API).
--   - magasinier        : gestion des entrées/sorties de stock et inventaires ;
--                         aucun accès aux prix d'achat fournisseurs.
--   - auditeur          : commissaire aux comptes ou contrôleur externe.
--                         Lecture seule sur l'ensemble (y compris audit log
--                         et liste des utilisateurs).
--
-- Rôles conservés pour rétrocompatibilité : proprietaire, admin, comptable,
-- rh, user, lecture. Les anciens membres existants restent valides.
--
-- La matrice complète des permissions vit dans backend/src/utils/permissions.js
-- (module x action -> liste de rôles). Toute correction des droits y est
-- centralisée, le middleware requirePermission() la consulte.
-- ============================================================================

ALTER TABLE membres_entreprise DROP CONSTRAINT IF EXISTS membres_entreprise_role_check;

ALTER TABLE membres_entreprise ADD CONSTRAINT membres_entreprise_role_check
  CHECK (role IN (
    'proprietaire',
    'admin',
    'expert_comptable',
    'comptable',
    'rh',
    'commercial',
    'magasinier',
    'auditeur',
    'user',
    'lecture'
  ));

COMMENT ON COLUMN membres_entreprise.role IS
  'Rôle métier du membre. Voir backend/src/utils/permissions.js pour la matrice. '
  'Valeurs : proprietaire (createur), admin (chef d''entreprise), '
  'expert_comptable (cabinet ONECCA), comptable (interne), rh, '
  'commercial, magasinier, auditeur (CAC), user/lecture (legacy).';

-- Index inchangé : pas de besoin de re-créer (existe déjà sur entreprise_id).
