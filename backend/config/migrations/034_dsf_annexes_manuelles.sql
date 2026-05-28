-- Migration 034 — Annexes manuelles de la liasse DSF.
--
-- Certaines annexes SYSCOHADA ne sont pas calculables depuis la compta :
--   - Commissaires aux comptes (honoraires + identité)
--   - Crédit-bail / location-acquisition (engagements futurs)
--   - Engagements hors bilan (cautions, avals, garanties)
--   - Litiges et risques
--   - Ventilation CA par activité / secteur géographique
--
-- L'EC les saisit depuis l'UI DSF et elles sont intégrées au PDF + CSV.
-- Stockage en JSONB pour flexibilité (chaque type a sa structure propre).

CREATE TABLE IF NOT EXISTS dsf_annexes_manuelles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  exercice_id   UUID NOT NULL REFERENCES exercices(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL CHECK (type IN (
    'commissaires_aux_comptes',
    'credit_bail',
    'engagements_hors_bilan',
    'litiges',
    'ca_par_activite'
  )),
  contenu JSONB NOT NULL DEFAULT '{}'::jsonb,
  modifie_par UUID REFERENCES utilisateurs(id),
  modifie_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (exercice_id, type)
);

CREATE INDEX IF NOT EXISTS idx_dsf_annexes_ent ON dsf_annexes_manuelles(entreprise_id, exercice_id);
