-- ============================================================================
-- MIGRATION 011 : CYCLE DE VIE DES DEVIS + CONVERSION EN FACTURE
-- ============================================================================
-- Objectif : donner aux devis (et proformas) un cycle de vie commercial propre,
-- indépendant du statut comptable des factures, et tracer la conversion
-- devis → facture dans les deux sens.
--
-- Mécanisme :
--   - devis_statut suit l'issue commerciale du devis :
--       en_attente → accepte / refuse / expire / converti
--     (la colonne statut existante reste à 'brouillon' : un devis n'est jamais
--      comptabilisé)
--   - l'expiration est posée automatiquement par le backend quand la date de
--     validité (date_echeance) est dépassée et que le devis est encore en_attente
--   - converti_facture_id : sur le devis, pointe vers la facture issue de sa
--     conversion ; devis_origine_id : sur la facture, pointe vers le devis source
-- ============================================================================

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS devis_statut VARCHAR(20)
    CHECK (devis_statut IN ('en_attente','accepte','refuse','expire','converti')),
  ADD COLUMN IF NOT EXISTS converti_facture_id UUID REFERENCES factures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS devis_origine_id UUID REFERENCES factures(id) ON DELETE SET NULL;

-- Les devis / proformas déjà en base passent par défaut en attente de réponse
UPDATE factures
  SET devis_statut = 'en_attente'
  WHERE type IN ('devis','proforma') AND devis_statut IS NULL;

CREATE INDEX IF NOT EXISTS idx_factures_devis_statut ON factures(devis_statut);
CREATE INDEX IF NOT EXISTS idx_factures_converti ON factures(converti_facture_id);
CREATE INDEX IF NOT EXISTS idx_factures_devis_origine ON factures(devis_origine_id);

COMMENT ON COLUMN factures.devis_statut IS
  'Issue commerciale d''un devis/proforma : en_attente, accepte, refuse, expire, converti. NULL pour les factures et avoirs.';
COMMENT ON COLUMN factures.converti_facture_id IS
  'Sur un devis : facture générée lors de sa conversion. NULL tant que le devis n''est pas converti.';
COMMENT ON COLUMN factures.devis_origine_id IS
  'Sur une facture : devis dont elle est issue. NULL si la facture a été créée directement.';
