-- ============================================================================
-- Migration 020 — File d'attente FNE + indicateur de statut DGI
--
-- Complète la migration 017 (factures_certifications_fne) pour rendre le
-- module fiscal robuste à trois scénarios réels :
--
--   1. Le serveur DGI tombe / a une latence anormale au moment d'une
--      certification → la facture est placée en file d'attente et rejouée
--      automatiquement plus tard.
--   2. L'utilisateur a coché « certification automatique » → toute facture
--      qui sort de l'état brouillon est certifiée sans clic supplémentaire,
--      en s'appuyant sur la même queue en cas d'échec.
--   3. L'admin a besoin de savoir, dans l'écran Paramètres → Fiscal, si
--      l'API DGI répond bien (pastille verte/rouge) — cette info est
--      mémorisée pour ne pas refaire un appel à chaque rafraîchissement.
--
-- À exécuter sur les bases existantes :
--   psql -U <user> -d comptawest -f config/migrations/020_fne_queue_ping.sql
-- ============================================================================

BEGIN;

-- 1) Trois colonnes utilitaires sur entreprises :
--    - fne_auto_certif : déclenche la certification automatiquement au
--      passage d'une facture en statut non-brouillon.
--    - fne_ping_statut / fne_ping_at : cache du dernier diagnostic DGI
--      pour éviter d'appeler l'API à chaque chargement d'écran.
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS fne_auto_certif BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fne_ping_statut VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fne_ping_at     TIMESTAMP;

COMMENT ON COLUMN entreprises.fne_auto_certif IS
  'Si TRUE, toute facture qui sort du brouillon est certifiée DGI sans action manuelle.';
COMMENT ON COLUMN entreprises.fne_ping_statut IS
  'Dernier état connu du serveur DGI : ok | down | unconfigured | mock.';

-- 2) File d'attente des certifications en échec / en attente de réseau.
--    Une ligne par facture à (re)synchroniser. La contrainte UNIQUE empêche
--    qu'une même facture occupe plusieurs slots de queue.
CREATE TABLE IF NOT EXISTS pending_sync_fne (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facture_id           UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  entreprise_id        UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,

  -- en_attente : pas encore tenté ou en cours de retry
  -- echec_definitif : seuil de tentatives atteint, intervention manuelle requise
  statut               VARCHAR(20) NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'echec_definitif')),

  nb_tentatives        INT  NOT NULL DEFAULT 0,
  derniere_tentative_at TIMESTAMP,
  prochaine_tentative_at TIMESTAMP NOT NULL DEFAULT NOW(),
  derniere_erreur      TEXT,

  -- Snapshot du payload au moment du push dans la queue (sert si la facture
  -- est modifiée entre-temps : on continue à tenter la version snapshotée
  -- ou on l'invalide selon la règle métier choisie). Pour ce MVP on
  -- ré-interroge la facture courante, mais on stocke quand même la trace.
  payload_snapshot     JSONB,

  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Une seule ligne en attente par facture : si on retente, on UPDATE.
  CONSTRAINT pending_sync_fne_facture_unique UNIQUE (facture_id)
);

-- Index pour le balayage du worker (toutes les factures dont la prochaine
-- tentative est dans le passé et qui ne sont pas en échec définitif).
CREATE INDEX IF NOT EXISTS idx_pending_fne_due
  ON pending_sync_fne (prochaine_tentative_at)
  WHERE statut = 'en_attente';

CREATE INDEX IF NOT EXISTS idx_pending_fne_entreprise
  ON pending_sync_fne (entreprise_id);

COMMIT;
