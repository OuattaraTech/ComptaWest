-- Migration 038 — Table `paiements_abonnement`.
--
-- Trace chaque tentative de paiement d'abonnement ApeX par une entreprise
-- via les trois fournisseurs supportés (Wave, Orange Money, Stripe). Sert
-- aussi en mode `mock` pour le développement et pour les démos commerciales
-- (le mode mock simule le succès en 2 secondes sans appel PSP réel).
--
-- Le statut suit l'état de la session côté PSP :
--   pending  → session créée, paiement en attente côté client
--   success  → confirmation reçue (webhook ou polling), abonnement activé
--   failed   → erreur ou refus PSP
--   expired  → session non finalisée après expires_at (15 min par défaut)
--
-- L'activation effective de l'abonnement (UPSERT dans `abonnements`) se
-- fait dans la transaction du webhook qui passe le statut à `success`.

BEGIN;

CREATE TABLE IF NOT EXISTS paiements_abonnement (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id      UUID         NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  utilisateur_id     UUID         REFERENCES utilisateurs(id) ON DELETE SET NULL,
  palier             VARCHAR(40)  NOT NULL CHECK (palier IN ('starter', 'pro')),
  periodicite        VARCHAR(10)  NOT NULL CHECK (periodicite IN ('mensuel', 'annuel')),
  montant_fcfa       INTEGER      NOT NULL CHECK (montant_fcfa > 0),
  moyen              VARCHAR(20)  NOT NULL CHECK (moyen IN ('wave', 'orange', 'stripe', 'mock')),
  statut             VARCHAR(20)  NOT NULL DEFAULT 'pending'
                                  CHECK (statut IN ('pending', 'success', 'failed', 'expired')),
  reference_externe  VARCHAR(255),                                   -- id de session côté PSP (Wave / Orange / Stripe)
  url_redirection    TEXT,                                           -- URL vers laquelle le client est envoyé (PSP ou page mock)
  metadata           JSONB        NOT NULL DEFAULT '{}',             -- payloads bruts PSP, infos debug
  erreur             TEXT,                                           -- message d'erreur si statut = failed
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,                                    -- moment du succès ou de l'échec
  expires_at         TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes')
);

COMMENT ON TABLE paiements_abonnement IS
  'Tentatives de paiement d''abonnement ApeX (Wave, Orange Money, Stripe). '
  'L''activation effective de abonnements se fait dans la transaction du webhook qui passe statut à success.';

CREATE INDEX IF NOT EXISTS idx_paiements_abonnement_entreprise
  ON paiements_abonnement (entreprise_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_paiements_abonnement_reference
  ON paiements_abonnement (reference_externe)
  WHERE reference_externe IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_paiements_abonnement_pending
  ON paiements_abonnement (statut, expires_at)
  WHERE statut = 'pending';

COMMIT;
