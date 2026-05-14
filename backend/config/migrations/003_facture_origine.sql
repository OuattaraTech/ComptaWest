-- ============================================
-- Migration 003 : Référence facture d'origine pour les avoirs
-- Conformité SYSCOHADA/OHADA : un avoir doit obligatoirement référencer la facture corrigée
-- À exécuter sur les bases existantes :
--   psql -U <user> -d comptawest -f config/migrations/003_facture_origine.sql
-- ============================================

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS facture_origine_id UUID REFERENCES factures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_factures_origine ON factures(facture_origine_id);

COMMENT ON COLUMN factures.facture_origine_id IS
  'Pour les avoirs : référence à la facture d''origine corrigée. Obligatoire selon SYSCOHADA.';
