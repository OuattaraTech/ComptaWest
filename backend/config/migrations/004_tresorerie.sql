-- ============================================================================
-- MIGRATION 004 : TRÉSORERIE (Banque + Mobile Money + Caisse) + RAPPROCHEMENT
-- ============================================================================
-- Objectif : permettre la gestion multi-comptes (banques, opérateurs mobile
-- money, caisses) avec import de relevés et rapprochement bancaire.
-- ============================================================================

-- ─── COMPTES DE TRÉSORERIE ─────────────────────────────────────────────────
-- Un compte représente un point d'argent réel : banque, mobile money, caisse.
-- Chaque compte est lié à un compte du plan comptable SYSCOHADA (5xxx) pour
-- alimenter automatiquement les écritures comptables.
CREATE TABLE IF NOT EXISTS comptes_tresorerie (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  nom VARCHAR(120) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('banque', 'mobile_money', 'caisse')),
  operateur VARCHAR(60),                  -- BICICI, BOA, Wave, Orange Money, MTN, Moov, Djamo, Trésor Money...
  numero_compte VARCHAR(60),              -- IBAN, numéro de compte ou numéro mobile money
  titulaire VARCHAR(120),                 -- nom du titulaire (utile pour mobile money personnel)
  devise VARCHAR(10) DEFAULT 'XOF',
  solde_initial DECIMAL(15, 2) DEFAULT 0,
  compte_pc_numero VARCHAR(20),           -- compte SYSCOHADA lié (ex: 5211, 5711, 5219)
  par_defaut BOOLEAN DEFAULT FALSE,       -- compte par défaut pour les nouveaux mouvements
  actif BOOLEAN DEFAULT TRUE,
  archived_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ct_entreprise ON comptes_tresorerie(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_ct_type ON comptes_tresorerie(entreprise_id, type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ct_un_defaut_par_type
  ON comptes_tresorerie(entreprise_id, type) WHERE par_defaut = TRUE AND archived_at IS NULL;

-- ─── MOUVEMENTS DE TRÉSORERIE ──────────────────────────────────────────────
-- Chaque entrée/sortie d'argent sur un compte. Le sens dit s'il s'agit d'un
-- encaissement (+) ou décaissement (−). La source indique l'origine
-- (paiement facture, dépense, transfert, saisie manuelle).
CREATE TABLE IF NOT EXISTS mouvements_tresorerie (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  compte_id UUID NOT NULL REFERENCES comptes_tresorerie(id) ON DELETE RESTRICT,
  date_operation DATE NOT NULL DEFAULT CURRENT_DATE,
  sens VARCHAR(10) NOT NULL CHECK (sens IN ('entree', 'sortie')),
  montant DECIMAL(15, 2) NOT NULL CHECK (montant > 0),
  libelle VARCHAR(255) NOT NULL,
  reference VARCHAR(100),                  -- réf externe (n° transaction Wave, n° chèque, etc.)
  source_type VARCHAR(30),                 -- 'paiement_facture' | 'depense' | 'manuel' | 'transfert' | 'releve'
  source_id UUID,                          -- id du paiement / dépense / transfert lié
  ecriture_id UUID REFERENCES ecritures(id) ON DELETE SET NULL,
  statut_rapprochement VARCHAR(20) DEFAULT 'non_rapproche'
    CHECK (statut_rapprochement IN ('non_rapproche', 'rapproche', 'ignore')),
  ligne_releve_id UUID,                    -- FK déclarée plus bas (forward reference)
  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mt_entreprise ON mouvements_tresorerie(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_mt_compte ON mouvements_tresorerie(compte_id, date_operation DESC);
CREATE INDEX IF NOT EXISTS idx_mt_source ON mouvements_tresorerie(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_mt_rapp ON mouvements_tresorerie(compte_id, statut_rapprochement);

-- ─── RELEVÉS BANCAIRES IMPORTÉS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS releves_bancaires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  compte_id UUID NOT NULL REFERENCES comptes_tresorerie(id) ON DELETE CASCADE,
  fichier_nom VARCHAR(255),
  date_debut DATE,
  date_fin DATE,
  solde_debut DECIMAL(15, 2),
  solde_fin DECIMAL(15, 2),
  nb_lignes INTEGER DEFAULT 0,
  importe_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_releves_compte ON releves_bancaires(compte_id, date_debut DESC);

-- ─── LIGNES DE RELEVÉ ──────────────────────────────────────────────────────
-- Chaque ligne du relevé importé, à matcher avec un mouvement_tresorerie.
CREATE TABLE IF NOT EXISTS lignes_releve (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  releve_id UUID NOT NULL REFERENCES releves_bancaires(id) ON DELETE CASCADE,
  date_operation DATE NOT NULL,
  date_valeur DATE,
  libelle TEXT NOT NULL,
  reference VARCHAR(100),
  sens VARCHAR(10) NOT NULL CHECK (sens IN ('entree', 'sortie')),
  montant DECIMAL(15, 2) NOT NULL CHECK (montant > 0),
  statut_matching VARCHAR(20) DEFAULT 'non_matche'
    CHECK (statut_matching IN ('non_matche', 'matche', 'ignore')),
  mouvement_id UUID REFERENCES mouvements_tresorerie(id) ON DELETE SET NULL,
  ordre INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lr_releve ON lignes_releve(releve_id, ordre);
CREATE INDEX IF NOT EXISTS idx_lr_matching ON lignes_releve(releve_id, statut_matching);
CREATE INDEX IF NOT EXISTS idx_lr_mouvement ON lignes_releve(mouvement_id);

-- Forward reference : lien réciproque mouvement → ligne
ALTER TABLE mouvements_tresorerie
  ADD CONSTRAINT fk_mt_ligne_releve FOREIGN KEY (ligne_releve_id)
  REFERENCES lignes_releve(id) ON DELETE SET NULL;

-- ─── INTÉGRATION AVEC PAIEMENTS ET DÉPENSES ────────────────────────────────
ALTER TABLE paiements
  ADD COLUMN IF NOT EXISTS compte_tresorerie_id UUID
  REFERENCES comptes_tresorerie(id) ON DELETE SET NULL;

ALTER TABLE depenses
  ADD COLUMN IF NOT EXISTS compte_tresorerie_id UUID
  REFERENCES comptes_tresorerie(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_paiements_compte ON paiements(compte_tresorerie_id);
CREATE INDEX IF NOT EXISTS idx_depenses_compte ON depenses(compte_tresorerie_id);

-- ─── SEED : comptes par défaut pour chaque entreprise existante ────────────
-- Création d'un compte Banque principale (5211) + Caisse principale (5711)
-- pour chaque entreprise qui n'en a pas encore.
INSERT INTO comptes_tresorerie (entreprise_id, nom, type, operateur, devise, compte_pc_numero, par_defaut)
SELECT e.id, 'Banque principale', 'banque', NULL, COALESCE(e.devise, 'XOF'), '5211', TRUE
FROM entreprises e
WHERE NOT EXISTS (
  SELECT 1 FROM comptes_tresorerie ct
  WHERE ct.entreprise_id = e.id AND ct.type = 'banque'
);

INSERT INTO comptes_tresorerie (entreprise_id, nom, type, operateur, devise, compte_pc_numero, par_defaut)
SELECT e.id, 'Caisse principale', 'caisse', NULL, COALESCE(e.devise, 'XOF'), '5711', TRUE
FROM entreprises e
WHERE NOT EXISTS (
  SELECT 1 FROM comptes_tresorerie ct
  WHERE ct.entreprise_id = e.id AND ct.type = 'caisse'
);

-- ─── RATTACHEMENT DES MOUVEMENTS HISTORIQUES ───────────────────────────────
-- Les paiements et dépenses existants pointent vers la Caisse principale ou
-- Banque principale selon leur mode_paiement, pour préserver la continuité.
UPDATE paiements p
SET compte_tresorerie_id = (
  SELECT id FROM comptes_tresorerie ct
  WHERE ct.entreprise_id = (SELECT f.entreprise_id FROM factures f WHERE f.id = p.facture_id)
    AND ct.type = CASE
      WHEN p.mode_paiement IN ('cash') THEN 'caisse'
      WHEN p.mode_paiement IN ('mobile_money') THEN 'mobile_money'
      ELSE 'banque'
    END
    AND ct.par_defaut = TRUE
  LIMIT 1
)
WHERE p.compte_tresorerie_id IS NULL;

-- Fallback : si pas de compte mobile_money par défaut, on rattache à la banque
UPDATE paiements p
SET compte_tresorerie_id = (
  SELECT id FROM comptes_tresorerie ct
  WHERE ct.entreprise_id = (SELECT f.entreprise_id FROM factures f WHERE f.id = p.facture_id)
    AND ct.par_defaut = TRUE AND ct.type = 'banque'
  LIMIT 1
)
WHERE p.compte_tresorerie_id IS NULL;

UPDATE depenses d
SET compte_tresorerie_id = (
  SELECT id FROM comptes_tresorerie ct
  WHERE ct.entreprise_id = d.entreprise_id
    AND ct.type = CASE
      WHEN d.mode_paiement IN ('cash') THEN 'caisse'
      WHEN d.mode_paiement IN ('mobile_money') THEN 'mobile_money'
      ELSE 'banque'
    END
    AND ct.par_defaut = TRUE
  LIMIT 1
)
WHERE d.compte_tresorerie_id IS NULL AND d.statut = 'payee';

UPDATE depenses d
SET compte_tresorerie_id = (
  SELECT id FROM comptes_tresorerie ct
  WHERE ct.entreprise_id = d.entreprise_id
    AND ct.par_defaut = TRUE AND ct.type = 'banque'
  LIMIT 1
)
WHERE d.compte_tresorerie_id IS NULL AND d.statut = 'payee';
