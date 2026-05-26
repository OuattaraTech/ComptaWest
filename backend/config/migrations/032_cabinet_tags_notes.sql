-- Migration 032 — Annotations privées des cabinets sur leurs clients PME.
--
-- Permet au cabinet de tagger ses clients (« VIP », « urgent », « prospect »…)
-- et d'ajouter des notes internes invisibles pour la PME.
-- Stockage au niveau de la connexion cabinet↔PME, pas de l'entreprise PME
-- (deux cabinets différents pourraient annoter la même PME différemment).

ALTER TABLE cabinet_connections
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes_privees TEXT;

-- Index GIN pour rechercher rapidement par tag
CREATE INDEX IF NOT EXISTS idx_cab_conn_tags ON cabinet_connections USING GIN (tags);
