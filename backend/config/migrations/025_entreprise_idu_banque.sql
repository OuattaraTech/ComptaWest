-- ============================================================================
-- MIGRATION 025 : IDU + coordonnées bancaires sur entreprises
-- ============================================================================
-- Champs requis par la DGI ivoirienne sur la facture certifiée FNE :
--
--   - IDU (Identifiant Unique) : code attribué à l'immatriculation par la
--     plateforme e-Régulation/CEPICI aux entreprises créées récemment.
--     Affiché sur la facture pour identification croisée DGI ↔ CEPICI.
--
--   - Coordonnées bancaires : recommandées par la DGI sur la facture pour
--     que le client puisse régler par virement avec les bonnes
--     coordonnées. Trois champs : banque (nom), rib (compte UEMOA 24
--     positions ou IBAN), swift (code SWIFT/BIC optionnel pour les
--     virements internationaux).
--
-- À exécuter sur les bases existantes :
--   psql -U <user> -d comptawest -f config/migrations/025_entreprise_idu_banque.sql
-- ============================================================================

BEGIN;

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS idu    VARCHAR(40),
  ADD COLUMN IF NOT EXISTS banque VARCHAR(120),
  ADD COLUMN IF NOT EXISTS rib    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS swift  VARCHAR(20);

COMMENT ON COLUMN entreprises.idu IS
  'Identifiant Unique attribué par le CEPICI à l''immatriculation de l''entreprise. '
  'Mention obligatoire sur la facture FNE pour les entreprises créées après 2023.';
COMMENT ON COLUMN entreprises.banque IS
  'Nom de la banque principale (ex : Banque Atlantique CI, SGBCI, NSIA Banque).';
COMMENT ON COLUMN entreprises.rib IS
  'RIB UEMOA 24 positions ou IBAN. Affiché en pied de facture pour les '
  'paiements par virement.';
COMMENT ON COLUMN entreprises.swift IS
  'Code SWIFT/BIC de la banque (optionnel, pour les virements internationaux).';

COMMIT;
