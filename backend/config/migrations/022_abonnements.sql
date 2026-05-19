-- ============================================================================
-- Migration 022 — Système d'abonnement et de quotas
--
-- Quatre paliers commerciaux : decouverte (gratuit), starter, pro, cabinet.
-- Chaque palier impose des limites sur :
--   * nombre d'utilisateurs (membres_entreprise)
--   * nombre d'entreprises gérées sous un même compte propriétaire
--   * nombre de factures émises par mois
--   * nombre de scans OCR par mois (compteur reset le 1er du mois)
--   * nombre de fournisseurs Mobile Money simultanés
--   * accès aux modules paie / immobilisations / API
--
-- La matrice de limites vit côté applicatif (backend/src/utils/quotas.js)
-- pour pouvoir être ajustée sans migration BD. Cette migration ne stocke
-- que le palier souscrit et les compteurs d'usage.
--
-- À exécuter sur les bases existantes :
--   psql -U <user> -d comptawest -f config/migrations/022_abonnements.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS abonnements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id   UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,

  -- Quatre paliers commerciaux. 'decouverte' est attribué par défaut
  -- à toute nouvelle entreprise (essai 30 jours).
  palier          VARCHAR(20) NOT NULL DEFAULT 'decouverte'
    CHECK (palier IN ('decouverte', 'starter', 'pro', 'cabinet')),

  -- Statut du cycle de vie : actif | suspendu (paiement raté) | expire.
  statut          VARCHAR(20) NOT NULL DEFAULT 'actif'
    CHECK (statut IN ('actif', 'suspendu', 'expire')),

  -- Périodicité de facturation choisie par le client.
  periodicite     VARCHAR(10) NOT NULL DEFAULT 'mensuel'
    CHECK (periodicite IN ('mensuel', 'annuel')),

  -- Démarrage et expiration. date_fin NULL = abonnement à durée indéterminée
  -- (tacite reconduction) ; valeur explicite = essai ou abonnement à terme.
  date_debut      DATE NOT NULL DEFAULT CURRENT_DATE,
  date_fin        DATE,

  -- Métadonnées pour le suivi commercial.
  prix_mensuel_fcfa  INT,
  notes_commerciales TEXT,

  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT abonnements_entreprise_unique UNIQUE (entreprise_id)
);

CREATE INDEX IF NOT EXISTS idx_abonnements_statut  ON abonnements (statut, date_fin);
CREATE INDEX IF NOT EXISTS idx_abonnements_palier  ON abonnements (palier);

-- Compteurs d'usage portés par entreprises (plus simple qu'une table
-- séparée pour le MVP — un seul UPDATE atomique par scan OCR).
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS ocr_scans_mois_courant INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ocr_scans_periode_mois INT,
  ADD COLUMN IF NOT EXISTS ocr_scans_periode_annee INT;

COMMENT ON COLUMN entreprises.ocr_scans_mois_courant IS
  'Compteur incrémenté à chaque scan OCR réussi. Reset auto par le code applicatif quand on détecte un changement de mois.';

-- Création automatique d'un abonnement « decouverte » pour toutes les
-- entreprises existantes au moment de la migration (30 jours d'essai
-- offerts à compter du déploiement).
INSERT INTO abonnements (entreprise_id, palier, statut, date_debut, date_fin)
SELECT id, 'decouverte', 'actif', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days'
FROM entreprises
WHERE id NOT IN (SELECT entreprise_id FROM abonnements);

COMMIT;
