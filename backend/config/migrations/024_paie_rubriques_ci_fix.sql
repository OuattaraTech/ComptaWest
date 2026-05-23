-- ============================================================================
-- MIGRATION 024 : conformité fiscale CI pour les rubriques de paie
-- ============================================================================
-- 4 corrections après audit d'un expert-comptable ivoirien :
--
--   1. Heures supplémentaires (HS_15, HS_50, HS_75, HS_100) :
--      Article 116 du CGI ivoirien — les heures supplémentaires sont
--      exonérées d'ITS dans la limite légale (12 h/semaine). On considère
--      l'exonération comme la règle par défaut ; un audit fiscal pourra
--      réintégrer le surplus au cas par cas. Restent soumises CNPS.
--
--   2. Indemnité de logement (IND_LOGEMENT) :
--      L'indemnité de logement EN ESPÈCES versée sur le bulletin est un
--      élément de salaire brut soumis à la fois à l'ITS ET à la CNPS
--      (dans la limite du plafond CNPS de 2 700 000 FCFA/mois). La
--      configuration historique ne soumettait à l'ITS — erreur corrigée.
--
--   3. Prime de transport (PRIME_TRANSPORT) :
--      Le seuil de 30 000 FCFA est codé en dur côté moteur de calcul
--      (utils/paie-ci.js). On ne touche pas à la rubrique elle-même
--      (imposable_its=FALSE, cotisable_cnps=FALSE par défaut), c'est la
--      fonction calculerBulletin qui split la partie au-dessus du seuil
--      en ajouts à baseIts et baseCnps. Le libellé est précisé pour
--      l'utilisateur.
--
--   4. Avantages en nature (AVN_LOGEMENT, AVN_VOITURE) :
--      Configuration imposable_its=TRUE + cotisable_cnps=TRUE conservée
--      (l'avantage entre bien dans le calcul du net imposable). La
--      différence : la BASE doit être le forfait DGI et non la valeur
--      réelle. Forfaits courants 2025 :
--        - Logement : 60 000 FCFA / pièce principale + 10 000 (eau) +
--                     20 000 (électricité) + 40 000 (mobilier) — ou
--                     15 % du salaire brut si supérieur.
--        - Voiture  : 60 000 FCFA / mois (≤ 7 CV) à 200 000 FCFA
--                     (> 13 CV) selon la puissance fiscale.
--      Le libellé est précisé pour rappeler à l'utilisateur de saisir
--      le forfait et non la valeur réelle ; un calcul automatique
--      basé sur ces forfaits viendra dans une migration ultérieure.
-- ============================================================================

BEGIN;

-- 1. Heures supplémentaires : retire l'ITS, garde la CNPS
UPDATE rubriques_paie
   SET imposable_its = FALSE
 WHERE code IN ('HS_15', 'HS_50', 'HS_75', 'HS_100');

-- 2. Indemnité de logement : ajoute la CNPS (ITS déjà coché)
UPDATE rubriques_paie
   SET cotisable_cnps = TRUE
 WHERE code = 'IND_LOGEMENT';

-- 3. Prime de transport : précise le libellé (le plafond est appliqué côté code)
UPDATE rubriques_paie
   SET libelle = 'Prime de transport (exonérée jusqu''à 30 000 FCFA/mois)'
 WHERE code = 'PRIME_TRANSPORT'
   AND libelle NOT LIKE '%exonérée%';

-- 4. Avantages en nature : libellé qui rappelle le forfait DGI
UPDATE rubriques_paie
   SET libelle = 'Avantage logement — saisir le forfait DGI'
 WHERE code = 'AVN_LOGEMENT'
   AND libelle NOT LIKE '%forfait%';

UPDATE rubriques_paie
   SET libelle = 'Avantage voiture — saisir le forfait DGI'
 WHERE code = 'AVN_VOITURE'
   AND libelle NOT LIKE '%forfait%';

COMMIT;
