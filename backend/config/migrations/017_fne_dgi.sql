-- Migration 017 — Facture Normalisée Électronique (FNE) — DGI Côte d'Ivoire
--
-- Anticipe l'obligation de certification fiscale des factures émises par les
-- entreprises soumises au RSI/RNI/IS. Le principe DGI CI : chaque facture
-- doit être déclarée à l'API DGI qui retourne un numéro fiscal unique
-- (« numéro FNE ») et un hash de contrôle. Le QR code imprimé sur la
-- facture encode ces éléments pour permettre la vérification publique.
--
-- Architecture choisie :
--   * Pas de couplage fort BD ↔ facture (table séparée) pour pouvoir
--     re-certifier ou contester sans toucher à `factures`.
--   * Champs DGI portés par `entreprises` car identiques à toutes les
--     factures émises par la même structure.

BEGIN;

-- 1) Identifiants et configuration DGI portés par l'entreprise
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS ncc            VARCHAR(30),
  ADD COLUMN IF NOT EXISTS centre_fiscal  VARCHAR(80),
  ADD COLUMN IF NOT EXISTS fne_actif      BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fne_mode       VARCHAR(20) NOT NULL DEFAULT 'mock'
    CHECK (fne_mode IN ('mock', 'sandbox', 'prod')),
  ADD COLUMN IF NOT EXISTS fne_api_key    TEXT,
  ADD COLUMN IF NOT EXISTS fne_certificat TEXT;

COMMENT ON COLUMN entreprises.ncc           IS 'Numéro de Compte Contribuable (DGI CI)';
COMMENT ON COLUMN entreprises.centre_fiscal IS 'Centre des impôts de rattachement';
COMMENT ON COLUMN entreprises.fne_mode      IS 'mock = pas d''appel DGI, sandbox = bac à sable, prod = certification réelle';

-- 2) Table des certifications FNE — 1 ligne par certification réussie
CREATE TABLE IF NOT EXISTS factures_certifications_fne (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facture_id        UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  entreprise_id     UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,

  -- Numéro fiscal délivré par la DGI (format : YYYYNNNNNNNNNN en prod,
  -- préfixé MOCK- en mode mock pour éviter toute confusion).
  numero_fne        VARCHAR(40) NOT NULL UNIQUE,

  -- Hash SHA-256 hex du payload normalisé envoyé à la DGI. Permet de
  -- prouver l'intégrité de la facture certifiée a posteriori.
  hash_facture      VARCHAR(64) NOT NULL,

  -- Données encodées dans le QR code (URL de vérification publique +
  -- numéro FNE + hash). Stockées telles quelles pour ne pas avoir à
  -- les recalculer à chaque rendu PDF.
  qr_data           TEXT NOT NULL,

  mode              VARCHAR(20) NOT NULL CHECK (mode IN ('mock', 'sandbox', 'prod')),
  dgi_response_raw  JSONB,

  certified_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  certified_by      UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,

  -- Une facture ne peut être certifiée qu'une fois ; en cas d'erreur, on
  -- crée plutôt une facture corrective. Cette contrainte protège contre
  -- les doubles appels DGI accidentels.
  CONSTRAINT factures_certifications_fne_facture_unique UNIQUE (facture_id)
);

CREATE INDEX IF NOT EXISTS idx_fne_entreprise   ON factures_certifications_fne (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_fne_certified_at ON factures_certifications_fne (certified_at DESC);

COMMIT;
