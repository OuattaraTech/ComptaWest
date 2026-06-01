-- Migration 042 — Collecte de documents cabinet ↔ PME (GED légère).
--
-- Permet à un cabinet partenaire de DEMANDER des pièces à ses PME clientes
-- (relevés bancaires, factures, contrats…), à la PME de les TÉLÉVERSER, et au
-- cabinet de VALIDER. Premier stockage de fichiers de l'app : les fichiers
-- sont sur disque (dossier configurable UPLOADS_DIR), seules les métadonnées
-- sont en base.
--
--   document_requests : la demande (libellé, catégorie, période, statut)
--   document_files    : les fichiers téléversés (rattachés à une demande)

BEGIN;

CREATE TABLE IF NOT EXISTS document_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cabinet_id  UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  pme_id      UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  libelle     VARCHAR(200) NOT NULL,
  categorie   VARCHAR(20)  NOT NULL DEFAULT 'autre'
                CHECK (categorie IN ('banque','facture','contrat','fiscal','social','autre')),
  periode     VARCHAR(20),
  note        TEXT,
  statut      VARCHAR(20)  NOT NULL DEFAULT 'demande'
                CHECK (statut IN ('demande','fourni','valide','refuse')),
  cree_par    UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_files (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id    UUID REFERENCES document_requests(id) ON DELETE CASCADE,
  cabinet_id    UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  pme_id        UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  nom_fichier   VARCHAR(255) NOT NULL,
  mime          VARCHAR(100),
  taille_octets INTEGER,
  chemin        VARCHAR(500) NOT NULL,   -- relatif à UPLOADS_DIR
  uploaded_par  UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docreq_pme       ON document_requests (pme_id);
CREATE INDEX IF NOT EXISTS idx_docreq_cabinet   ON document_requests (cabinet_id);
CREATE INDEX IF NOT EXISTS idx_docreq_statut    ON document_requests (statut);
CREATE INDEX IF NOT EXISTS idx_docfile_request  ON document_files (request_id);

COMMIT;
