-- ============================================
-- Migration 019 : Trigger DB de garantie d'équilibre par écriture
--
-- Filet de sécurité contre tout bug applicatif futur qui tenterait de
-- créer une écriture où SUM(débit) ≠ SUM(crédit). La validation principale
-- reste dans creerEcriture() (utils/comptabilite.js) qui rejette avant
-- INSERT — ce trigger n'agit que si quelqu'un contourne ce helper.
--
-- DEFERRABLE INITIALLY DEFERRED : l'insertion des lignes se fait
-- séquentiellement, le contrôle ne doit donc s'exécuter qu'à la fin de la
-- transaction, quand toutes les lignes de l'écriture sont en place.
--
-- À exécuter sur les bases existantes :
--   psql -U <user> -d comptawest -f config/migrations/019_trigger_equilibre_ecriture.sql
-- ============================================

-- Audit préalable : si des écritures déséquilibrées existent déjà en BD,
-- on les liste et on échoue clairement plutôt que de bloquer toutes les
-- transactions futures sur ces lignes anciennes.
DO $$
DECLARE
  nb_desequilibrees INT;
  details TEXT;
BEGIN
  WITH soldes AS (
    SELECT ecriture_id,
           COALESCE(SUM(debit), 0) AS d,
           COALESCE(SUM(credit), 0) AS c
      FROM lignes_ecriture
     GROUP BY ecriture_id
  )
  SELECT COUNT(*),
         STRING_AGG(ecriture_id::text || ' (D=' || d || ' C=' || c || ')', ', ')
    INTO nb_desequilibrees, details
    FROM soldes
   WHERE ABS(d - c) > 0.01;

  IF nb_desequilibrees > 0 THEN
    RAISE EXCEPTION
      'Migration 019 bloquée : % écriture(s) déséquilibrée(s) en BD. '
      'À régulariser avant d''activer le trigger. Détail : %',
      nb_desequilibrees, details;
  END IF;
END $$;

-- Fonction de contrôle : recalcule l'équilibre de l'écriture impactée.
-- Tolère le cas où l'écriture n'a plus de lignes (DELETE total avant suppression).
CREATE OR REPLACE FUNCTION verifier_equilibre_ecriture()
RETURNS TRIGGER AS $$
DECLARE
  v_ecriture_id UUID;
  v_debit       DECIMAL(15,2);
  v_credit      DECIMAL(15,2);
  v_nb          INT;
BEGIN
  v_ecriture_id := COALESCE(NEW.ecriture_id, OLD.ecriture_id);

  SELECT COUNT(*),
         COALESCE(SUM(debit), 0),
         COALESCE(SUM(credit), 0)
    INTO v_nb, v_debit, v_credit
    FROM lignes_ecriture
   WHERE ecriture_id = v_ecriture_id;

  -- Écriture vidée (cascade ou suppression complète) : OK, rien à vérifier.
  IF v_nb = 0 THEN
    RETURN NULL;
  END IF;

  IF ABS(v_debit - v_credit) > 0.01 THEN
    RAISE EXCEPTION
      'Écriture % déséquilibrée : débit=%, crédit=% (différence %)',
      v_ecriture_id, v_debit, v_credit, (v_debit - v_credit);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_equilibre_ecriture ON lignes_ecriture;

CREATE CONSTRAINT TRIGGER trg_equilibre_ecriture
  AFTER INSERT OR UPDATE OR DELETE ON lignes_ecriture
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION verifier_equilibre_ecriture();
