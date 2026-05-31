-- Migration 039 — Bascule sur l'agrégateur CinetPay.
--
-- CinetPay (société ivoirienne) agrège Wave, Orange Money, MTN MoMo et
-- les cartes bancaires Visa/Mastercard derrière une API unique avec un
-- payout direct en FCFA sur compte bancaire CI. On remplace l'approche
-- précédente (3 intégrations directes Wave / Orange / Stripe) par cette
-- intégration agrégateur tout-en-un.
--
-- Côté schéma : la colonne `moyen` accepte désormais aussi 'cinetpay'.
-- On conserve les valeurs historiques ('wave', 'orange', 'stripe') car
-- elles décrivent le bouton sur lequel l'utilisateur a cliqué — toutes
-- ces sessions sont en réalité créées chez CinetPay (avec un channel
-- pré-sélectionné MOBILE_MONEY ou CREDIT_CARD selon le moyen).

BEGIN;

ALTER TABLE paiements_abonnement
  DROP CONSTRAINT IF EXISTS paiements_abonnement_moyen_check;

ALTER TABLE paiements_abonnement
  ADD CONSTRAINT paiements_abonnement_moyen_check
  CHECK (moyen IN ('wave', 'orange', 'mtn', 'stripe', 'cinetpay', 'mock'));

COMMIT;
