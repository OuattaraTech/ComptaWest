-- ============================================
-- Migration 018 : Unicité (entreprise_id, origine, origine_id) sur ecritures
--
-- Empêche les doublons d'écritures automatiques en cas de retry réseau ou
-- double-clic utilisateur (ex : valider deux fois le même bulletin, payer
-- deux fois la même facture). Les écritures MANUEL n'ont pas d'origine_id
-- et sont donc exclues par le WHERE partiel.
--
-- À exécuter sur les bases existantes :
--   psql -U <user> -d comptawest -f config/migrations/018_ecritures_origine_unique.sql
-- ============================================

-- Garde-fou : détecte les doublons existants avant de tenter la création
-- de l'index. Si la migration échoue ici, l'admin doit identifier et
-- supprimer manuellement les écritures en double (ou les fusionner) avant
-- de relancer.
DO $$
DECLARE
  nb_doublons INT;
BEGIN
  SELECT COUNT(*) INTO nb_doublons FROM (
    SELECT entreprise_id, origine, origine_id, COUNT(*) AS n
    FROM ecritures
    WHERE origine_id IS NOT NULL AND origine != 'MANUEL'
    GROUP BY entreprise_id, origine, origine_id
    HAVING COUNT(*) > 1
  ) d;

  IF nb_doublons > 0 THEN
    RAISE EXCEPTION
      'Migration 018 bloquée : % couple(s) (origine, origine_id) en doublon détecté(s). '
      'Exécutez la requête suivante pour les lister, puis supprimez/fusionnez avant de réessayer : '
      'SELECT entreprise_id, origine, origine_id, COUNT(*) FROM ecritures '
      'WHERE origine_id IS NOT NULL AND origine != ''MANUEL'' '
      'GROUP BY 1,2,3 HAVING COUNT(*) > 1;',
      nb_doublons;
  END IF;
END $$;

-- Index unique partiel : seuls les couples avec origine_id non null et
-- origine != MANUEL sont contraints. Les OD manuelles peuvent rester
-- librement multiples (un utilisateur peut légitimement passer plusieurs
-- OD distinctes le même jour sans lien métier).
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecritures_origine_unique
  ON ecritures (entreprise_id, origine, origine_id)
  WHERE origine_id IS NOT NULL AND origine != 'MANUEL';
