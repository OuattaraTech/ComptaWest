-- ============================================
-- ComptaWest V2 — Schéma complet
-- Nouveautés : Multi-entreprise, Dépenses, Taxes
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENTREPRISES ─────────────────────────────
CREATE TABLE IF NOT EXISTS entreprises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom VARCHAR(150) NOT NULL,
  sigle VARCHAR(30),
  forme_juridique VARCHAR(30) DEFAULT 'SARL' CHECK (forme_juridique IN ('SARL','SA','GIE','EI','SNC','SCS','EURL','Autre')),
  secteur VARCHAR(80),
  email VARCHAR(150),
  telephone VARCHAR(20),
  adresse TEXT,
  ville VARCHAR(80),
  pays VARCHAR(50) DEFAULT 'Côte d''Ivoire',
  ninea VARCHAR(50),
  rccm VARCHAR(50),
  regime_fiscal VARCHAR(30) DEFAULT 'RSI' CHECK (regime_fiscal IN ('RSI','RNI','IS','BIC','Exonéré')),
  taux_tva DECIMAL(5,2) DEFAULT 18.00,
  devise VARCHAR(10) DEFAULT 'FCFA',
  logo_url TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── UTILISATEURS ────────────────────────────
CREATE TABLE IF NOT EXISTS utilisateurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  mot_de_passe VARCHAR(255) NOT NULL,
  telephone VARCHAR(20),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── MEMBRES ENTREPRISE (liaison N-N avec rôle) ─
CREATE TABLE IF NOT EXISTS membres_entreprise (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  utilisateur_id UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('proprietaire','admin','comptable','user','lecture')),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(utilisateur_id, entreprise_id)
);

-- ─── CLIENTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  code VARCHAR(20),
  nom VARCHAR(150) NOT NULL,
  type VARCHAR(20) DEFAULT 'entreprise' CHECK (type IN ('entreprise','particulier')),
  email VARCHAR(150),
  telephone VARCHAR(20),
  adresse TEXT,
  ville VARCHAR(100),
  pays VARCHAR(50) DEFAULT 'Côte d''Ivoire',
  ninea VARCHAR(50),
  rccm VARCHAR(50),
  solde DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entreprise_id, code)
);

-- ─── FACTURES ────────────────────────────────
CREATE TABLE IF NOT EXISTS factures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  cree_par UUID REFERENCES utilisateurs(id),
  numero VARCHAR(30) NOT NULL,
  type VARCHAR(20) DEFAULT 'facture' CHECK (type IN ('facture','devis','avoir','proforma')),
  statut VARCHAR(20) DEFAULT 'brouillon' CHECK (statut IN ('brouillon','envoyee','payee','en_attente','retard','annulee')),
  date_emission DATE NOT NULL DEFAULT CURRENT_DATE,
  date_echeance DATE,
  sous_total DECIMAL(15,2) DEFAULT 0,
  taux_tva DECIMAL(5,2) DEFAULT 18.00,
  montant_tva DECIMAL(15,2) DEFAULT 0,
  total_ttc DECIMAL(15,2) DEFAULT 0,
  montant_paye DECIMAL(15,2) DEFAULT 0,
  devise VARCHAR(10) DEFAULT 'FCFA',
  notes TEXT,
  conditions_paiement TEXT DEFAULT 'Paiement à 30 jours',
  facture_origine_id UUID REFERENCES factures(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entreprise_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_factures_origine ON factures(facture_origine_id);

-- ─── LIGNES FACTURE ───────────────────────────
CREATE TABLE IF NOT EXISTS lignes_facture (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facture_id UUID REFERENCES factures(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantite DECIMAL(10,3) DEFAULT 1,
  unite VARCHAR(20) DEFAULT 'unité',
  prix_unitaire DECIMAL(15,2) NOT NULL,
  remise DECIMAL(5,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  ordre INTEGER DEFAULT 0
);

-- ─── CATÉGORIES DE DÉPENSES ──────────────────
CREATE TABLE IF NOT EXISTS categories_depenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  nom VARCHAR(80) NOT NULL,
  code VARCHAR(10),            -- Code SYSCOHADA (ex: 60, 61, 62...)
  couleur VARCHAR(10) DEFAULT '#6B7A99',
  est_systeme BOOLEAN DEFAULT false,  -- catégories prédéfinies non supprimables
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── DÉPENSES ────────────────────────────────
CREATE TABLE IF NOT EXISTS depenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  categorie_id UUID REFERENCES categories_depenses(id) ON DELETE SET NULL,
  cree_par UUID REFERENCES utilisateurs(id),
  numero VARCHAR(30),
  description TEXT NOT NULL,
  fournisseur VARCHAR(150),
  montant_ht DECIMAL(15,2) NOT NULL,
  taux_tva DECIMAL(5,2) DEFAULT 0,
  montant_tva DECIMAL(15,2) DEFAULT 0,
  montant_ttc DECIMAL(15,2) NOT NULL,
  date_depense DATE NOT NULL DEFAULT CURRENT_DATE,
  date_echeance DATE,
  statut VARCHAR(20) DEFAULT 'payee' CHECK (statut IN ('payee','en_attente','annulee')),
  mode_paiement VARCHAR(30) DEFAULT 'virement' CHECK (mode_paiement IN ('cash','virement','cheque','mobile_money','carte')),
  reference VARCHAR(100),
  justificatif_url TEXT,
  notes TEXT,
  est_recurrente BOOLEAN DEFAULT false,
  periodicite VARCHAR(20),     -- mensuel, trimestriel, annuel
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── TAXES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS declarations_taxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  cree_par UUID REFERENCES utilisateurs(id),
  type_taxe VARCHAR(30) NOT NULL CHECK (type_taxe IN ('TVA','IS','BIC','CNSS','CMU','IRVM','Patente','Autre')),
  organisme VARCHAR(80),        -- DGI, CNSS, CGRAE...
  periode_debut DATE NOT NULL,
  periode_fin DATE NOT NULL,
  date_echeance DATE NOT NULL,
  montant_base DECIMAL(15,2) NOT NULL DEFAULT 0,
  taux DECIMAL(5,2) DEFAULT 0,
  montant_du DECIMAL(15,2) NOT NULL DEFAULT 0,
  montant_paye DECIMAL(15,2) DEFAULT 0,
  statut VARCHAR(20) DEFAULT 'a_payer' CHECK (statut IN ('a_payer','payee','en_retard','annulee','exoneree')),
  reference_paiement VARCHAR(100),
  date_paiement DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── COMPTABILITÉ SYSCOHADA ──────────────────
CREATE TABLE IF NOT EXISTS plan_comptable (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  numero VARCHAR(15) NOT NULL,
  libelle VARCHAR(200) NOT NULL,
  classe SMALLINT NOT NULL CHECK (classe BETWEEN 1 AND 9),
  nature VARCHAR(15) NOT NULL CHECK (nature IN ('ACTIF','PASSIF','CHARGE','PRODUIT','HAO','ANALYTIQUE')),
  est_systeme BOOLEAN DEFAULT false,
  est_lettrable BOOLEAN DEFAULT false,
  parent_numero VARCHAR(15),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entreprise_id, numero)
);

CREATE TABLE IF NOT EXISTS exercices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  libelle VARCHAR(80) NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  cloture BOOLEAN DEFAULT false,
  date_cloture TIMESTAMP,
  cloture_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (date_fin > date_debut),
  UNIQUE(entreprise_id, date_debut, date_fin)
);

CREATE TABLE IF NOT EXISTS journaux (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  code VARCHAR(8) NOT NULL,
  libelle VARCHAR(80) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('VENTE','ACHAT','BANQUE','CAISSE','OD','A_NOUVEAU')),
  compte_contrepartie VARCHAR(15),
  est_systeme BOOLEAN DEFAULT false,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entreprise_id, code)
);

CREATE TABLE IF NOT EXISTS ecritures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  exercice_id UUID REFERENCES exercices(id) ON DELETE RESTRICT,
  journal_id UUID REFERENCES journaux(id) ON DELETE RESTRICT,
  numero_piece VARCHAR(40) NOT NULL,
  date_ecriture DATE NOT NULL,
  libelle VARCHAR(255) NOT NULL,
  reference VARCHAR(80),
  origine VARCHAR(40),
  origine_id UUID,
  validee BOOLEAN DEFAULT true,
  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entreprise_id, numero_piece)
);

CREATE TABLE IF NOT EXISTS lignes_ecriture (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ecriture_id UUID NOT NULL REFERENCES ecritures(id) ON DELETE CASCADE,
  compte_id UUID NOT NULL REFERENCES plan_comptable(id) ON DELETE RESTRICT,
  compte_numero VARCHAR(15) NOT NULL,
  libelle VARCHAR(255),
  debit DECIMAL(15,2) DEFAULT 0 CHECK (debit >= 0),
  credit DECIMAL(15,2) DEFAULT 0 CHECK (credit >= 0),
  lettrage VARCHAR(10),
  ordre SMALLINT DEFAULT 0,
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

-- ─── AUDIT LOG ────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  utilisateur_id UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  utilisateur_email VARCHAR(150),
  action VARCHAR(40) NOT NULL,
  entite VARCHAR(40) NOT NULL,
  entite_id UUID,
  details JSONB,
  ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── PAIEMENTS FACTURES ───────────────────────
CREATE TABLE IF NOT EXISTS paiements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facture_id UUID REFERENCES factures(id) ON DELETE CASCADE,
  montant DECIMAL(15,2) NOT NULL,
  date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement VARCHAR(30) DEFAULT 'virement',
  reference VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── INDEX ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_membres_user ON membres_entreprise(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_membres_entreprise ON membres_entreprise(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_clients_entreprise ON clients(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_factures_entreprise ON factures(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut);
CREATE INDEX IF NOT EXISTS idx_depenses_entreprise ON depenses(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_depenses_categorie ON depenses(categorie_id);
CREATE INDEX IF NOT EXISTS idx_depenses_date ON depenses(date_depense);
CREATE INDEX IF NOT EXISTS idx_taxes_entreprise ON declarations_taxes(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_taxes_statut ON declarations_taxes(statut);
CREATE INDEX IF NOT EXISTS idx_taxes_echeance ON declarations_taxes(date_echeance);
CREATE INDEX IF NOT EXISTS idx_audit_entreprise ON audit_log(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_audit_utilisateur ON audit_log(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_audit_entite ON audit_log(entite, entite_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

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

-- ─── DONNÉES DÉMO ─────────────────────────────

-- Utilisateur demo
INSERT INTO utilisateurs (id, nom, email, mot_de_passe, telephone)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Ouattara',
  'demo@comptawest.ci',
  '$2a$10$rBnNMXrBV9.mFTH0a8E8G.FVfkHjXqTbNQQm5GQyBwWv1w3QFZO8e',
  '+225 07 00 00 00'
) ON CONFLICT DO NOTHING;

-- Entreprise principale
INSERT INTO entreprises (id, nom, sigle, forme_juridique, secteur, email, telephone, ville, pays, ninea, rccm, regime_fiscal)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'Ouattara & Associés',
  'O&A',
  'SARL',
  'Services informatiques',
  'contact@ouattara-associes.ci',
  '+225 27 22 00 00',
  'Abidjan',
  'Côte d''Ivoire',
  'CI-2020-A-12345',
  'RCC/ABJ/2020/B/1234',
  'RSI'
) ON CONFLICT DO NOTHING;

-- Deuxième entreprise (multi-entreprise)
INSERT INTO entreprises (id, nom, sigle, forme_juridique, secteur, email, ville, pays, regime_fiscal)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'dev225 Technologies',
  'dev225',
  'EI',
  'Développement web & mobile',
  'hello@dev225.ci',
  'Abidjan',
  'Côte d''Ivoire',
  'RSI'
) ON CONFLICT DO NOTHING;

-- Lier utilisateur aux deux entreprises
INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role) VALUES
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'proprietaire'),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'proprietaire')
ON CONFLICT DO NOTHING;

-- Catégories de dépenses système (SYSCOHADA)
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur, est_systeme) VALUES
('b0000000-0000-0000-0000-000000000001', 'Achats de marchandises', '60', '#4E8BF5', true),
('b0000000-0000-0000-0000-000000000001', 'Transports', '61', '#F5A623', true),
('b0000000-0000-0000-0000-000000000001', 'Services extérieurs', '62', '#00D4AA', true),
('b0000000-0000-0000-0000-000000000001', 'Impôts & taxes', '63', '#FF5C6B', true),
('b0000000-0000-0000-0000-000000000001', 'Charges de personnel', '66', '#A855F7', true),
('b0000000-0000-0000-0000-000000000001', 'Loyer & charges locatives', '62L', '#EC4899', true),
('b0000000-0000-0000-0000-000000000001', 'Télécommunications', '62T', '#06B6D4', true),
('b0000000-0000-0000-0000-000000000001', 'Équipements & matériel', '24', '#84CC16', true),
('b0000000-0000-0000-0000-000000000001', 'Charges financières', '67', '#F97316', true),
('b0000000-0000-0000-0000-000000000001', 'Autres charges', '65', '#6B7A99', true)
ON CONFLICT DO NOTHING;

-- Clients démo
INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, ville, ninea) VALUES
('b0000000-0000-0000-0000-000000000001', 'CLI-001', 'SARL Konan & Fils', 'entreprise', 'konan@example.ci', '+225 07 00 11 22', 'Abidjan', 'CI-2019-B-12345'),
('b0000000-0000-0000-0000-000000000001', 'CLI-002', 'Import-Export Diabaté', 'entreprise', 'diabate@example.ci', '+225 05 33 44 55', 'Bouaké', 'CI-2020-A-67890'),
('b0000000-0000-0000-0000-000000000001', 'CLI-003', 'GIE Femmes du Sahel', 'entreprise', 'gie@example.ci', '+225 01 66 77 88', 'Abidjan', NULL),
('b0000000-0000-0000-0000-000000000001', 'CLI-004', 'Négoce Traoré SARL', 'entreprise', 'traore@example.ci', '+225 07 99 00 11', 'San-Pédro', NULL)
ON CONFLICT DO NOTHING;

-- Dépenses démo
INSERT INTO depenses (entreprise_id, cree_par, numero, description, fournisseur, montant_ht, taux_tva, montant_tva, montant_ttc, date_depense, statut, mode_paiement,
  categorie_id)
SELECT 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'D-2024-042', 'Loyer Bureau Plateau - Décembre', 'Immobilier Plateau CI',
  271186, 18, 48814, 320000, '2024-12-13', 'payee', 'virement',
  id FROM categories_depenses WHERE nom = 'Loyer & charges locatives' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO depenses (entreprise_id, cree_par, numero, description, fournisseur, montant_ht, taux_tva, montant_tva, montant_ttc, date_depense, statut, mode_paiement,
  categorie_id)
SELECT 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'D-2024-041', 'Abonnement Orange Business', 'Orange CI',
  72034, 18, 12966, 85000, '2024-11-28', 'payee', 'mobile_money',
  id FROM categories_depenses WHERE nom = 'Télécommunications' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO depenses (entreprise_id, cree_par, numero, description, fournisseur, montant_ht, taux_tva, montant_tva, montant_ttc, date_depense, statut, mode_paiement,
  categorie_id)
SELECT 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'D-2024-040', 'Salaires équipe - Novembre', 'Interne',
  2100000, 0, 0, 2100000, '2024-11-30', 'payee', 'virement',
  id FROM categories_depenses WHERE nom = 'Charges de personnel' LIMIT 1
ON CONFLICT DO NOTHING;

-- Taxes démo
INSERT INTO declarations_taxes (entreprise_id, cree_par, type_taxe, organisme, periode_debut, periode_fin, date_echeance, montant_base, taux, montant_du, montant_paye, statut) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'TVA', 'DGI', '2024-11-01', '2024-11-30', '2024-12-20',
  7100000, 18.00, 1278000, 1278000, 'payee'),
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'TVA', 'DGI', '2024-12-01', '2024-12-31', '2025-01-20',
  10200000, 18.00, 1836000, 0, 'a_payer'),
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'CNSS', 'CNSS', '2024-12-01', '2024-12-31', '2025-01-15',
  2100000, 14.00, 294000, 0, 'a_payer'),
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'IS', 'DGI', '2024-01-01', '2024-12-31', '2025-04-30',
  36100000, 25.00, 9025000, 0, 'a_payer'),
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'CNSS', 'CNSS', '2024-11-01', '2024-11-30', '2024-12-15',
  2100000, 14.00, 294000, 294000, 'payee')
ON CONFLICT DO NOTHING;
