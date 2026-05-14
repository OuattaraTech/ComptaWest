-- ============================================================================
-- MIGRATION 007 : CATALOGUE PRODUITS & STOCKS SYSCOHADA
-- ============================================================================
-- Objectif : gestion d'un catalogue produits/services avec suivi de stocks
-- et inventaires physiques. Mise en cohérence avec les comptes SYSCOHADA :
--   - 31x : Marchandises et matières au bilan
--   - 60x : Achats (601 marchandises, 604 mat. premières, 605 autres achats)
--   - 70x : Ventes (701 marchandises, 705 produits finis, 706 services)
-- ============================================================================

-- ─── CATÉGORIES DE PRODUITS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories_produits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  code VARCHAR(30) NOT NULL,
  libelle VARCHAR(120) NOT NULL,
  type VARCHAR(15) NOT NULL DEFAULT 'produit' CHECK (type IN ('produit', 'service')),
  compte_vente VARCHAR(20),               -- ex : 701 marchandises, 706 services
  compte_achat VARCHAR(20),               -- ex : 601, 604
  compte_stock VARCHAR(20),               -- ex : 311 marchandises (NULL pour services)
  taux_tva DECIMAL(5, 2) DEFAULT 18,
  ordre INTEGER DEFAULT 100,
  systeme BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (entreprise_id, code)
);
CREATE INDEX IF NOT EXISTS idx_cat_prod_entreprise ON categories_produits(entreprise_id);

-- ─── PRODUITS / SERVICES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  code VARCHAR(40) NOT NULL,
  libelle VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(15) NOT NULL DEFAULT 'produit' CHECK (type IN ('produit', 'service')),
  categorie_id UUID REFERENCES categories_produits(id) ON DELETE SET NULL,

  -- Prix & TVA
  prix_vente_ht DECIMAL(15, 2) DEFAULT 0,
  prix_achat_ht DECIMAL(15, 2) DEFAULT 0,
  taux_tva DECIMAL(5, 2) DEFAULT 18,
  unite VARCHAR(30) DEFAULT 'unité',          -- unité, pièce, kg, heure, m², m³...

  -- Stock (uniquement pour type 'produit')
  stock_initial DECIMAL(12, 3) DEFAULT 0,
  stock_actuel DECIMAL(12, 3) DEFAULT 0,      -- mis à jour en triggered/calculé
  seuil_alerte DECIMAL(12, 3),                -- alerte si stock_actuel <= seuil
  cmp DECIMAL(15, 4) DEFAULT 0,               -- coût moyen pondéré actuel
  valeur_stock DECIMAL(15, 2) DEFAULT 0,      -- stock_actuel × cmp
  methode_valorisation VARCHAR(10) DEFAULT 'CMP' CHECK (methode_valorisation IN ('CMP', 'FIFO')),

  -- Comptes SYSCOHADA (hérités de la catégorie ou personnalisés)
  compte_vente VARCHAR(20),
  compte_achat VARCHAR(20),
  compte_stock VARCHAR(20),

  -- Méta
  reference_externe VARCHAR(100),              -- code-barres, EAN, SKU
  fournisseur_principal VARCHAR(200),
  notes TEXT,
  actif BOOLEAN DEFAULT TRUE,
  archived_at TIMESTAMP,

  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (entreprise_id, code)
);
CREATE INDEX IF NOT EXISTS idx_produits_entreprise ON produits(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_produits_categorie ON produits(categorie_id);
CREATE INDEX IF NOT EXISTS idx_produits_type ON produits(entreprise_id, type);
CREATE INDEX IF NOT EXISTS idx_produits_actif ON produits(entreprise_id, actif) WHERE archived_at IS NULL;

-- ─── MOUVEMENTS DE STOCK ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mouvements_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE RESTRICT,
  date_mouvement DATE NOT NULL DEFAULT CURRENT_DATE,
  sens VARCHAR(10) NOT NULL CHECK (sens IN ('entree', 'sortie', 'ajustement')),
  quantite DECIMAL(12, 3) NOT NULL,            -- toujours positive ; le sens donne la direction
  prix_unitaire DECIMAL(15, 4) DEFAULT 0,      -- coût pour les entrées, CMP pour les sorties
  valeur_totale DECIMAL(15, 2) DEFAULT 0,      -- quantite × prix_unitaire (signe selon sens)
  stock_apres DECIMAL(12, 3),                  -- stock après ce mouvement
  cmp_apres DECIMAL(15, 4),                    -- CMP recalculé après ce mouvement
  source_type VARCHAR(30),                     -- 'vente', 'achat', 'manuel', 'inventaire', 'retour'
  source_id UUID,                              -- id de la facture / dépense / inventaire lié
  libelle VARCHAR(255),
  reference VARCHAR(100),
  ecriture_id UUID REFERENCES ecritures(id) ON DELETE SET NULL,
  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mvtstock_entreprise ON mouvements_stock(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_mvtstock_produit ON mouvements_stock(produit_id, date_mouvement DESC);
CREATE INDEX IF NOT EXISTS idx_mvtstock_source ON mouvements_stock(source_type, source_id);

-- ─── INVENTAIRES PHYSIQUES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventaires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  numero VARCHAR(40) NOT NULL,
  date_inventaire DATE NOT NULL,
  libelle VARCHAR(200),
  statut VARCHAR(20) NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon', 'valide', 'annule')),

  -- Synthèse (calculée à la validation)
  nb_articles INTEGER DEFAULT 0,
  valeur_theorique DECIMAL(15, 2) DEFAULT 0,
  valeur_physique DECIMAL(15, 2) DEFAULT 0,
  ecart_total DECIMAL(15, 2) DEFAULT 0,

  ecriture_id UUID REFERENCES ecritures(id) ON DELETE SET NULL,
  notes TEXT,
  cree_par UUID REFERENCES utilisateurs(id),
  valide_par UUID REFERENCES utilisateurs(id),
  date_validation TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (entreprise_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_inventaires_entreprise ON inventaires(entreprise_id, date_inventaire DESC);

-- ─── LIGNES D'INVENTAIRE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lignes_inventaire (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventaire_id UUID NOT NULL REFERENCES inventaires(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE RESTRICT,
  stock_theorique DECIMAL(12, 3) DEFAULT 0,
  stock_physique DECIMAL(12, 3) DEFAULT 0,
  ecart DECIMAL(12, 3) DEFAULT 0,                -- physique − théorique (signé)
  cmp DECIMAL(15, 4) DEFAULT 0,
  valeur_theorique DECIMAL(15, 2) DEFAULT 0,
  valeur_physique DECIMAL(15, 2) DEFAULT 0,
  valeur_ecart DECIMAL(15, 2) DEFAULT 0,
  notes VARCHAR(255),
  ordre INTEGER DEFAULT 100
);
CREATE INDEX IF NOT EXISTS idx_lignes_inv_inventaire ON lignes_inventaire(inventaire_id, ordre);
CREATE INDEX IF NOT EXISTS idx_lignes_inv_produit ON lignes_inventaire(produit_id);

-- ─── LIEN PRODUIT → LIGNES DE FACTURE ──────────────────────────────────────
ALTER TABLE lignes_facture
  ADD COLUMN IF NOT EXISTS produit_id UUID REFERENCES produits(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lignes_facture_produit ON lignes_facture(produit_id);

-- ─── LIEN PRODUIT → DÉPENSES (optionnel, pour les achats simples) ──────────
ALTER TABLE depenses
  ADD COLUMN IF NOT EXISTS produit_id UUID REFERENCES produits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantite_achetee DECIMAL(12, 3);
CREATE INDEX IF NOT EXISTS idx_depenses_produit ON depenses(produit_id);

-- ─── COMPTES SYSCOHADA pour les stocks (si manquants) ──────────────────────
INSERT INTO plan_comptable (entreprise_id, numero, libelle, classe, nature, actif)
SELECT e.id, c.numero, c.libelle, c.classe, c.nature, TRUE
FROM entreprises e
CROSS JOIN (VALUES
  -- Classe 3 : Stocks (actif circulant)
  ('311',  'Marchandises',                                3, 'ACTIF'),
  ('321',  'Matières premières',                          3, 'ACTIF'),
  ('331',  'En-cours de production',                      3, 'ACTIF'),
  ('351',  'Produits finis',                              3, 'ACTIF'),
  ('361',  'Produits intermédiaires',                     3, 'ACTIF'),
  -- Achats stockés
  ('601',  'Achats de marchandises',                      6, 'CHARGE'),
  ('604',  'Achats stockés de matières premières',        6, 'CHARGE'),
  ('605',  'Autres achats',                               6, 'CHARGE'),
  ('608',  'Achats d''emballages',                        6, 'CHARGE'),
  -- Variations de stocks (pour valorisation finale)
  ('6031', 'Variations stocks de marchandises',           6, 'CHARGE'),
  ('6033', 'Variations stocks autres approvisionnements', 6, 'CHARGE'),
  ('7331', 'Variations stocks produits finis',            7, 'PRODUIT'),
  -- Ventes
  ('701',  'Ventes de marchandises',                      7, 'PRODUIT'),
  ('702',  'Ventes de produits finis',                    7, 'PRODUIT'),
  ('705',  'Travaux facturés',                            7, 'PRODUIT'),
  ('707',  'Produits accessoires',                        7, 'PRODUIT'),
  -- Ajustements
  ('6588', 'Charges diverses - écarts d''inventaire',     6, 'CHARGE'),
  ('7588', 'Produits divers - écarts d''inventaire',      7, 'PRODUIT')
) AS c(numero, libelle, classe, nature)
WHERE NOT EXISTS (
  SELECT 1 FROM plan_comptable pc WHERE pc.entreprise_id = e.id AND pc.numero = c.numero
);

-- ─── SEED : catégories de produits pré-paramétrées ─────────────────────────
INSERT INTO categories_produits
  (entreprise_id, code, libelle, type, compte_vente, compte_achat, compte_stock, taux_tva, ordre, systeme)
SELECT e.id, c.code, c.libelle, c.type, c.compte_vente, c.compte_achat, c.compte_stock, c.taux_tva, c.ordre, TRUE
FROM entreprises e
CROSS JOIN (VALUES
  ('MARCHANDISE',     'Marchandises (revente)',         'produit', '701', '601', '311', 18,  10),
  ('PRODUIT_FINI',    'Produits finis (fabrication)',   'produit', '702', NULL,  '351', 18,  20),
  ('MAT_PREMIERE',    'Matières premières',             'produit', NULL,  '604', '321', 18,  30),
  ('CONSOMMABLE',     'Consommables',                   'produit', NULL,  '605', NULL,  18,  40),
  ('EMBALLAGE',       'Emballages',                     'produit', NULL,  '608', NULL,  18,  50),
  ('SERVICE',         'Prestations de services',        'service', '706', NULL,  NULL,  18,  60),
  ('TRAVAUX',         'Travaux facturés',               'service', '705', NULL,  NULL,  18,  70),
  ('FORMATION',       'Formations',                     'service', '706', NULL,  NULL,  18,  80)
) AS c(code, libelle, type, compte_vente, compte_achat, compte_stock, taux_tva, ordre)
WHERE NOT EXISTS (
  SELECT 1 FROM categories_produits cp
  WHERE cp.entreprise_id = e.id AND cp.code = c.code
);
