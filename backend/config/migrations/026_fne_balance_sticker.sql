-- ============================================================================
-- MIGRATION 026 : cache du solde de stickers FNE sur entreprises
-- ============================================================================
-- À chaque certification réussie, la DGI renvoie le champ balance_sticker
-- (stock restant) et éventuellement un drapeau warning si le stock est bas.
-- On en cache la dernière valeur connue dans entreprises pour pouvoir
-- afficher un bandeau dashboard « Solde stickers : 178 » sans rappeler
-- l'API DGI à chaque chargement d'écran.
--
-- FAQ DGI Q#28 : si le solde est épuisé, la DGI donne 48 h de grâce
-- avant blocage des certifications. Le bandeau ApeX permet d'anticiper
-- ce blocage en alertant dès que le seuil descend sous un certain niveau.
--
-- Tarifs stickers (FAQ Q#9) :
--   FNE                              : 20 FCFA TTC
--   RNE                              : 15 FCFA TTC
--   RNE espèces > 100 000 FCFA       : 25 FCFA TTC
--   RNE transactions 1-5 000 FCFA    : gratuit
--
-- À exécuter sur les bases existantes :
--   psql -U <user> -d comptawest -f config/migrations/026_fne_balance_sticker.sql
-- ============================================================================

BEGIN;

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS fne_balance_sticker    INTEGER,
  ADD COLUMN IF NOT EXISTS fne_balance_warning    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fne_balance_updated_at TIMESTAMP;

COMMENT ON COLUMN entreprises.fne_balance_sticker IS
  'Dernier solde de stickers FNE remonté par la DGI lors d''une certification. '
  'NULL = jamais certifié ou mode mock. Rafraîchi à chaque appel /external/invoices/sign.';
COMMENT ON COLUMN entreprises.fne_balance_warning IS
  'TRUE si la DGI a remonté warning=true lors de la dernière certification '
  '(stock proche de l''épuisement). Sert à afficher un bandeau d''alerte.';

COMMIT;
