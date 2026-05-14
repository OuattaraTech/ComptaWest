-- ============================================
-- Migration 002 : Comptabilité SYSCOHADA Révisé
-- Plan comptable, exercices, journaux, écritures double-entrée
-- À exécuter sur les bases existantes :
--   psql -U <user> -d comptawest -f config/migrations/002_comptabilite_schema.sql
-- ============================================

-- ─── PLAN COMPTABLE ──────────────────────────
-- Référentiel des comptes SYSCOHADA Révisé.
-- numero : code comptable normalisé (ex : 411, 6011, 4431)
-- classe : 1-9 (1 ressources durables, 2 actif immo, 3 stocks, 4 tiers, 5 trésorerie,
--               6 charges, 7 produits, 8 autres charges/produits HAO, 9 analytique)
-- nature : ACTIF | PASSIF | CHARGE | PRODUIT | HAO | ANALYTIQUE
-- est_systeme : true pour les comptes du référentiel SYSCOHADA (non supprimables)
CREATE TABLE IF NOT EXISTS plan_comptable (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  numero VARCHAR(15) NOT NULL,
  libelle VARCHAR(200) NOT NULL,
  classe SMALLINT NOT NULL CHECK (classe BETWEEN 1 AND 9),
  nature VARCHAR(15) NOT NULL CHECK (nature IN ('ACTIF','PASSIF','CHARGE','PRODUIT','HAO','ANALYTIQUE')),
  est_systeme BOOLEAN DEFAULT false,
  est_lettrable BOOLEAN DEFAULT false,  -- comptes 4 (tiers) typiquement
  parent_numero VARCHAR(15),             -- pour reconstruire l'arborescence (NULL pour comptes racine)
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entreprise_id, numero)
);

-- ─── EXERCICES COMPTABLES ────────────────────
-- Un exercice = une période (souvent l'année civile) qui peut être ouverte ou clôturée.
-- Aucune écriture ne peut être créée sur un exercice clôturé.
CREATE TABLE IF NOT EXISTS exercices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  libelle VARCHAR(80) NOT NULL,           -- ex: "Exercice 2026"
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  cloture BOOLEAN DEFAULT false,
  date_cloture TIMESTAMP,
  cloture_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (date_fin > date_debut),
  UNIQUE(entreprise_id, date_debut, date_fin)
);

-- ─── JOURNAUX COMPTABLES ─────────────────────
-- Code court (3-5 caractères) + libellé. Codes standards : VTE, ACH, BNK, CAI, MM, OD, AN.
CREATE TABLE IF NOT EXISTS journaux (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  code VARCHAR(8) NOT NULL,
  libelle VARCHAR(80) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('VENTE','ACHAT','BANQUE','CAISSE','OD','A_NOUVEAU')),
  compte_contrepartie VARCHAR(15),  -- pour journaux trésorerie : compte 521, 571, 524… utilisé par défaut
  est_systeme BOOLEAN DEFAULT false,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entreprise_id, code)
);

-- ─── ÉCRITURES COMPTABLES ────────────────────
-- Une écriture = un évènement comptable (ex : "Facture FAC-2026-001 émise au client X").
-- Composée de plusieurs lignes débit/crédit qui doivent s'équilibrer (somme débits = somme crédits).
CREATE TABLE IF NOT EXISTS ecritures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  exercice_id UUID REFERENCES exercices(id) ON DELETE RESTRICT,
  journal_id UUID REFERENCES journaux(id) ON DELETE RESTRICT,
  numero_piece VARCHAR(40) NOT NULL,        -- ex: "VTE-2026-00001"
  date_ecriture DATE NOT NULL,
  libelle VARCHAR(255) NOT NULL,
  reference VARCHAR(80),                    -- N° facture, n° dépense, etc.
  origine VARCHAR(40),                      -- AUTO_FACTURE, AUTO_PAIEMENT, AUTO_DEPENSE, AUTO_TAXE, MANUEL
  origine_id UUID,                          -- id de l'entité métier liée (facture/dépense/etc.)
  validee BOOLEAN DEFAULT true,             -- false = brouillon (pas remontée dans les rapports)
  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entreprise_id, numero_piece)
);

-- ─── LIGNES D'ÉCRITURE ───────────────────────
-- Chaque ligne porte EXACTEMENT un débit OU un crédit (jamais les deux).
-- compte_numero est dénormalisé pour éviter le coût d'un join sur tous les rapports.
CREATE TABLE IF NOT EXISTS lignes_ecriture (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ecriture_id UUID NOT NULL REFERENCES ecritures(id) ON DELETE CASCADE,
  compte_id UUID NOT NULL REFERENCES plan_comptable(id) ON DELETE RESTRICT,
  compte_numero VARCHAR(15) NOT NULL,       -- dénormalisation pour les rapports
  libelle VARCHAR(255),
  debit DECIMAL(15,2) DEFAULT 0 CHECK (debit >= 0),
  credit DECIMAL(15,2) DEFAULT 0 CHECK (credit >= 0),
  lettrage VARCHAR(10),                     -- code de lettrage (rapprochement client/fournisseur)
  ordre SMALLINT DEFAULT 0,
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

-- ─── INDEX ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pc_entreprise ON plan_comptable(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_pc_numero ON plan_comptable(entreprise_id, numero);
CREATE INDEX IF NOT EXISTS idx_pc_classe ON plan_comptable(entreprise_id, classe);

CREATE INDEX IF NOT EXISTS idx_exercices_entreprise ON exercices(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_exercices_dates ON exercices(entreprise_id, date_debut, date_fin);

CREATE INDEX IF NOT EXISTS idx_journaux_entreprise ON journaux(entreprise_id);

CREATE INDEX IF NOT EXISTS idx_ecritures_entreprise ON ecritures(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_ecritures_exercice ON ecritures(exercice_id);
CREATE INDEX IF NOT EXISTS idx_ecritures_journal ON ecritures(journal_id);
CREATE INDEX IF NOT EXISTS idx_ecritures_date ON ecritures(date_ecriture DESC);
CREATE INDEX IF NOT EXISTS idx_ecritures_origine ON ecritures(origine, origine_id);

CREATE INDEX IF NOT EXISTS idx_lignes_ecriture ON lignes_ecriture(ecriture_id);
CREATE INDEX IF NOT EXISTS idx_lignes_compte ON lignes_ecriture(compte_id);
CREATE INDEX IF NOT EXISTS idx_lignes_compte_numero ON lignes_ecriture(compte_numero);
CREATE INDEX IF NOT EXISTS idx_lignes_lettrage ON lignes_ecriture(lettrage) WHERE lettrage IS NOT NULL;
