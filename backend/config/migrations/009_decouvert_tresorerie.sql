-- ============================================================================
-- MIGRATION 009 : CONTRÔLE DE SOLDE TRÉSORERIE
-- ============================================================================
-- Objectif : empêcher les sorties qui mettent un compte à découvert
-- non autorisé. Une caisse ou un wallet mobile money ne peut jamais
-- physiquement passer sous zéro. Une banque peut, dans la limite du
-- découvert autorisé négocié.
-- ============================================================================

ALTER TABLE comptes_tresorerie
  ADD COLUMN IF NOT EXISTS decouvert_autorise BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS decouvert_max DECIMAL(15, 2) DEFAULT 0;

-- Paramétrage par défaut selon le type de compte :
--   - Banque : découvert autorisé activé (par défaut max 0, l'utilisateur précise)
--   - Caisse / Mobile money : interdit absolu
UPDATE comptes_tresorerie
SET decouvert_autorise = TRUE
WHERE type = 'banque' AND archived_at IS NULL;

-- Les comptes mobile_money et caisse restent à decouvert_autorise = FALSE
-- (valeur par défaut). Pour info aucune mise à jour explicite nécessaire,
-- la valeur par défaut s'applique aux lignes existantes.

COMMENT ON COLUMN comptes_tresorerie.decouvert_autorise IS
  'Si TRUE, le solde peut devenir négatif jusqu''à -decouvert_max. Si FALSE, blocage strict à 0.';
COMMENT ON COLUMN comptes_tresorerie.decouvert_max IS
  'Plafond du découvert autorisé en valeur absolue. Le solde ne peut pas descendre sous -decouvert_max.';
