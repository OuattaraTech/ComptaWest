-- ============================================================================
-- MIGRATION 016 : INTÉGRATION PAIEMENTS EXTERNES (Wave, Orange Money, MTN)
-- ============================================================================
-- Objectif : permettre à une PME ivoirienne d'émettre une facture puis de
-- recevoir le paiement directement sur son compte Mobile Money, via un lien
-- transmis au client (WhatsApp, SMS, email).
--
-- Architecture :
--   1. integrations_paiement : configuration par entreprise (clé API, secret
--      webhook, mode sandbox/live). Chaque PME a son propre compte marchand
--      Wave/Orange/MTN ; ComptaWest ne fait que router.
--   2. sessions_paiement : trace de chaque lien généré pour une facture.
--      Lifecycle : initiee -> en_attente -> payee | echouee | expiree.
--      L'arrivée du webhook (lot A.2) bascule au statut payee et déclenche
--      la création du mouvement de trésorerie + le paiement de la facture.
--
-- Sécurité :
--   - api_key et webhook_secret sont stockés en clair pour le MVP ;
--     prévoir un chiffrement applicatif (pgcrypto + clé maître env) lors
--     d'un futur durcissement de sécurité.
--   - raw_payload garde la réponse brute Wave pour debug / audit.
--
-- Voir backend/src/utils/wave.js pour le service d'appel à l'API Wave.
-- ============================================================================

CREATE TABLE IF NOT EXISTS integrations_paiement (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id   UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  fournisseur     VARCHAR(20) NOT NULL CHECK (fournisseur IN ('wave', 'orange_money', 'mtn_momo')),
  api_key         TEXT,
  webhook_secret  TEXT,
  mode            VARCHAR(10) NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox', 'live', 'mock')),
  -- Compte de trésorerie sur lequel les paiements reçus seront imputés
  -- (ex. l'identifiant du compte "Wave Pro" dans la table comptes_tresorerie).
  -- NULL = compte par défaut sera utilisé.
  compte_tresorerie_id  UUID REFERENCES comptes_tresorerie(id) ON DELETE SET NULL,
  actif           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Une intégration unique par couple (entreprise, fournisseur).
  UNIQUE (entreprise_id, fournisseur)
);

CREATE INDEX IF NOT EXISTS idx_integrations_paiement_entreprise
  ON integrations_paiement (entreprise_id);

COMMENT ON TABLE integrations_paiement IS
  'Configuration des moyens de paiement externes (Wave, Orange Money, MTN MoMo) par entreprise.';

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sessions_paiement (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id       UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  facture_id          UUID REFERENCES factures(id) ON DELETE SET NULL,
  fournisseur         VARCHAR(20) NOT NULL CHECK (fournisseur IN ('wave', 'orange_money', 'mtn_momo')),
  -- ID de session côté fournisseur (cs_xxx chez Wave, etc.)
  session_id_externe  VARCHAR(120) NOT NULL,
  -- URL à transmettre au payeur (deep link Wave, page de paiement, etc.)
  url_paiement        TEXT NOT NULL,
  montant             NUMERIC(14, 2) NOT NULL CHECK (montant > 0),
  devise              VARCHAR(5) NOT NULL DEFAULT 'XOF',
  statut              VARCHAR(20) NOT NULL DEFAULT 'initiee'
                       CHECK (statut IN ('initiee', 'en_attente', 'payee', 'echouee', 'expiree', 'annulee')),
  -- Marqué payé : moment où le webhook a confirmé l'encaissement
  paye_at             TIMESTAMP,
  expire_at           TIMESTAMP,
  -- ID du mouvement de trésorerie créé après réception du paiement (lot A.2)
  mouvement_id        UUID REFERENCES mouvements_tresorerie(id) ON DELETE SET NULL,
  -- Numéro de téléphone du payeur (rempli quand la session est payée)
  payeur_telephone    VARCHAR(30),
  payeur_nom          VARCHAR(150),
  -- Réponse brute Wave (création + webhook). Sert au debug et à l'audit.
  raw_payload         JSONB,
  cree_par            UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (fournisseur, session_id_externe)
);

CREATE INDEX IF NOT EXISTS idx_sessions_paiement_entreprise
  ON sessions_paiement (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_sessions_paiement_facture
  ON sessions_paiement (facture_id);
CREATE INDEX IF NOT EXISTS idx_sessions_paiement_statut
  ON sessions_paiement (statut);

COMMENT ON TABLE sessions_paiement IS
  'Sessions de paiement externe (Wave / Orange Money / MTN MoMo) générées pour les factures.';
