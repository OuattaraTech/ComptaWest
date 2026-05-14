-- ============================================================================
-- MIGRATION 008 : FOURNISSEURS & CYCLE ACHAT SYSCOHADA
-- ============================================================================
-- Symétrique du module Clients. Permet de :
--   - Suivre les comptes auxiliaires fournisseurs (401xxx)
--   - Tracer les dettes par tiers (échéancier, lettrage)
--   - Émettre des bons de commande
--   - Convertir BC → dépense / facture fournisseur
-- ============================================================================

-- ─── FOURNISSEURS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fournisseurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  code VARCHAR(20),                                  -- code interne (auto si vide)
  code_auxiliaire VARCHAR(20),                       -- compte 4011xxx SYSCOHADA
  nom VARCHAR(200) NOT NULL,
  type VARCHAR(20) DEFAULT 'entreprise' CHECK (type IN ('entreprise', 'particulier', 'administration')),
  email VARCHAR(150),
  telephone VARCHAR(30),
  contact_principal VARCHAR(120),
  adresse TEXT,
  ville VARCHAR(100),
  pays VARCHAR(50) DEFAULT 'Côte d''Ivoire',
  ninea VARCHAR(50),
  rccm VARCHAR(50),
  -- Conditions commerciales par défaut
  delai_paiement_jours INTEGER DEFAULT 30,
  mode_paiement_defaut VARCHAR(20) DEFAULT 'virement'
    CHECK (mode_paiement_defaut IN ('virement', 'cash', 'cheque', 'mobile_money', 'carte')),
  banque VARCHAR(120),
  rib VARCHAR(100),
  numero_mobile_money VARCHAR(30),
  -- Comptes SYSCOHADA d'imputation (charges)
  compte_charge_defaut VARCHAR(20),                  -- ex : 605 services, 601 marchandises…
  -- Statut
  solde DECIMAL(15, 2) DEFAULT 0,                    -- recalculé (somme dépenses non payées)
  notes TEXT,
  actif BOOLEAN DEFAULT TRUE,
  archived_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (entreprise_id, code)
);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_entreprise ON fournisseurs(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_actif ON fournisseurs(entreprise_id, actif) WHERE archived_at IS NULL;

-- ─── BONS DE COMMANDE D'ACHAT ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commandes_achat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  numero VARCHAR(40) NOT NULL,
  fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id) ON DELETE RESTRICT,
  date_commande DATE NOT NULL DEFAULT CURRENT_DATE,
  date_livraison_prevue DATE,
  date_reception DATE,                               -- date de réception effective
  reference_fournisseur VARCHAR(100),                -- réf. interne du fournisseur

  -- Totaux
  sous_total DECIMAL(15, 2) DEFAULT 0,
  taux_tva DECIMAL(5, 2) DEFAULT 18,
  montant_tva DECIMAL(15, 2) DEFAULT 0,
  total_ttc DECIMAL(15, 2) DEFAULT 0,

  -- Workflow
  statut VARCHAR(20) NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon', 'envoyee', 'receptionnee', 'facturee', 'annulee')),

  -- Liens
  depense_id UUID REFERENCES depenses(id) ON DELETE SET NULL,    -- dépense créée à la facturation
  date_envoi TIMESTAMP,
  date_facturation TIMESTAMP,

  notes TEXT,
  conditions TEXT,
  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (entreprise_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_bc_entreprise ON commandes_achat(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_bc_fournisseur ON commandes_achat(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_bc_statut ON commandes_achat(entreprise_id, statut);

-- ─── LIGNES DE BON DE COMMANDE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lignes_commande_achat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commande_id UUID NOT NULL REFERENCES commandes_achat(id) ON DELETE CASCADE,
  produit_id UUID REFERENCES produits(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantite DECIMAL(12, 3) NOT NULL DEFAULT 1,
  unite VARCHAR(30) DEFAULT 'unité',
  prix_unitaire DECIMAL(15, 4) NOT NULL,
  remise DECIMAL(5, 2) DEFAULT 0,
  total DECIMAL(15, 2) NOT NULL,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lc_achat_commande ON lignes_commande_achat(commande_id, ordre);
CREATE INDEX IF NOT EXISTS idx_lc_achat_produit ON lignes_commande_achat(produit_id);

-- ─── PAIEMENTS FOURNISSEURS ────────────────────────────────────────────────
-- Un paiement peut couvrir une ou plusieurs dépenses (lettrage).
CREATE TABLE IF NOT EXISTS paiements_fournisseur (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id) ON DELETE RESTRICT,
  depense_id UUID REFERENCES depenses(id) ON DELETE SET NULL,
  montant DECIMAL(15, 2) NOT NULL CHECK (montant > 0),
  date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement VARCHAR(20) DEFAULT 'virement'
    CHECK (mode_paiement IN ('virement', 'cash', 'cheque', 'mobile_money', 'carte')),
  reference VARCHAR(100),
  compte_tresorerie_id UUID REFERENCES comptes_tresorerie(id) ON DELETE SET NULL,
  mouvement_tresorerie_id UUID REFERENCES mouvements_tresorerie(id) ON DELETE SET NULL,
  ecriture_id UUID REFERENCES ecritures(id) ON DELETE SET NULL,
  notes TEXT,
  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_paie_fou_entreprise ON paiements_fournisseur(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_paie_fou_fournisseur ON paiements_fournisseur(fournisseur_id, date_paiement DESC);
CREATE INDEX IF NOT EXISTS idx_paie_fou_depense ON paiements_fournisseur(depense_id);

-- ─── LIAISON DÉPENSES ↔ FOURNISSEURS ───────────────────────────────────────
ALTER TABLE depenses
  ADD COLUMN IF NOT EXISTS fournisseur_id UUID REFERENCES fournisseurs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commande_achat_id UUID REFERENCES commandes_achat(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_depenses_fournisseur ON depenses(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_depenses_commande ON depenses(commande_achat_id);

-- ─── COMPTES SYSCOHADA pour les fournisseurs ───────────────────────────────
INSERT INTO plan_comptable (entreprise_id, numero, libelle, classe, nature, actif)
SELECT e.id, c.numero, c.libelle, c.classe, c.nature, TRUE
FROM entreprises e
CROSS JOIN (VALUES
  ('401',  'Fournisseurs (général)',                              4, 'PASSIF'),
  ('4011', 'Fournisseurs auxiliaires - tiers ordinaires',         4, 'PASSIF'),
  ('4012', 'Fournisseurs auxiliaires - groupe',                   4, 'PASSIF'),
  ('408',  'Fournisseurs - factures non parvenues',               4, 'PASSIF'),
  ('409',  'Fournisseurs débiteurs (avances, RRR)',               4, 'ACTIF')
) AS c(numero, libelle, classe, nature)
WHERE NOT EXISTS (
  SELECT 1 FROM plan_comptable pc WHERE pc.entreprise_id = e.id AND pc.numero = c.numero
);
