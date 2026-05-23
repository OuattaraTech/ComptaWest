-- ============================================================================
-- MIGRATION 027 : motif d'exemption FNE au niveau facture
-- ============================================================================
-- Certaines factures sont hors obligation FNE (FAQ DGI Q#6, #7, #19) :
--   - Loyers d'immeubles nus (SCI) : quittance hors FNE
--   - Billets d'avion (agence de voyage) : non concernés
--   - Pharmacies, banques, assurances, compagnies aériennes, services
--     publics (eau, électricité, télécom), La Poste : dispensés
--   - Concessionnaires pétroliers sous contrat : dispensés
--
-- Champ optionnel sur factures permettant à l'utilisateur de marquer
-- explicitement une facture comme hors FNE avec son motif. Quand ce
-- champ est non NULL :
--   - executerCertification skip silencieusement (pas de tentative
--     d'appel DGI) ;
--   - le PDF affiche un encart « DISPENSÉE FNE — motif » au lieu du
--     sticker FNE en haut-droite ;
--   - le rapport DGI mensuel exclut ces factures du décompte.
--
-- À exécuter sur les bases existantes :
--   psql -U <user> -d comptawest -f config/migrations/027_factures_fne_exempt.sql
-- ============================================================================

BEGIN;

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS fne_exempt_motif VARCHAR(60);

COMMENT ON COLUMN factures.fne_exempt_motif IS
  'Si non NULL, cette facture est hors obligation FNE. Valeurs courantes : '
  'loyer_immeuble_nu, billet_avion, pharmacie, banque_assurance, '
  'service_public, compagnie_aerienne, concession_petroliere, autre. '
  'Voir FAQ DGI Q#6, #7, #19.';

COMMIT;
