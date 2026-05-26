-- Migration 033 — Échéances fiscales marquées comme traitées par le cabinet.
--
-- Permet à l'EC, depuis le calendrier fiscal de /cabinet, de masquer une
-- échéance qu'il a déjà traitée (déclaration déposée) sans avoir à
-- attendre que le système la détecte automatiquement via les écritures.
--
-- V1 simple : table d'override manuel. V2 pourrait croiser avec les
-- écritures comptables réelles (ex: si compte 4421 mouvementé sur la
-- période → ITS faite).
--
-- Clé naturelle (cabinet, pme, type, periode) pour idempotence du POST.

CREATE TABLE IF NOT EXISTS cabinet_echeances_traitees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  pme_id     UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('ITS','TVA','CNPS','IS','DSF')),
  periode DATE NOT NULL,
  traite_par UUID REFERENCES utilisateurs(id),
  traite_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT,
  UNIQUE (cabinet_id, pme_id, type, periode)
);

CREATE INDEX IF NOT EXISTS idx_cab_ech_traitees_cabinet ON cabinet_echeances_traitees(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_cab_ech_traitees_pme ON cabinet_echeances_traitees(pme_id);
