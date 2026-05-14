-- ============================================================================
-- MIGRATION 006 : IMMOBILISATIONS & AMORTISSEMENTS SYSCOHADA
-- ============================================================================
-- Objectif : gérer les actifs immobilisés (comptes 21-24) et calculer
-- automatiquement les dotations annuelles (compte 681 / 28x).
-- ============================================================================

-- ─── CATÉGORIES D'IMMOBILISATIONS ──────────────────────────────────────────
-- Catalogue pré-paramétré des catégories courantes avec leurs comptes
-- SYSCOHADA et durées d'amortissement standards. Modifiable par entreprise.
CREATE TABLE IF NOT EXISTS categories_immobilisation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  code VARCHAR(30) NOT NULL,
  libelle VARCHAR(120) NOT NULL,
  compte_actif VARCHAR(20) NOT NULL,        -- compte SYSCOHADA d'immobilisation (21x-24x)
  compte_amortissement VARCHAR(20),         -- compte d'amortissements cumulés (28x)
  compte_dotation VARCHAR(20),              -- compte de dotations (681x)
  duree_annees DECIMAL(5, 2) NOT NULL,      -- durée d'amortissement par défaut
  methode VARCHAR(15) NOT NULL DEFAULT 'lineaire' CHECK (methode IN ('lineaire', 'degressif')),
  coefficient_degressif DECIMAL(4, 2),      -- 1.5 / 2 / 2.5 selon durée (si dégressif)
  amortissable BOOLEAN DEFAULT TRUE,        -- les terrains ne s'amortissent pas
  ordre INTEGER DEFAULT 100,
  systeme BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (entreprise_id, code)
);
CREATE INDEX IF NOT EXISTS idx_categories_immo_entreprise ON categories_immobilisation(entreprise_id);

-- ─── IMMOBILISATIONS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS immobilisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  numero_inventaire VARCHAR(40) NOT NULL,       -- unique par entreprise
  libelle VARCHAR(200) NOT NULL,
  description TEXT,
  categorie_id UUID REFERENCES categories_immobilisation(id) ON DELETE SET NULL,

  -- Comptes SYSCOHADA (figés à la création, peuvent diverger de la catégorie)
  compte_actif VARCHAR(20) NOT NULL,
  compte_amortissement VARCHAR(20),
  compte_dotation VARCHAR(20),

  -- Valeurs
  date_acquisition DATE NOT NULL,
  date_mise_en_service DATE,                    -- point de départ de l'amortissement
  valeur_acquisition DECIMAL(15, 2) NOT NULL CHECK (valeur_acquisition >= 0),
  valeur_residuelle DECIMAL(15, 2) DEFAULT 0,   -- valeur en fin de vie (≠ 0 pour véhicules p.ex.)

  -- Amortissement
  amortissable BOOLEAN NOT NULL DEFAULT TRUE,
  duree_annees DECIMAL(5, 2),                   -- NULL si non amortissable
  methode VARCHAR(15) DEFAULT 'lineaire' CHECK (methode IN ('lineaire', 'degressif')),
  coefficient_degressif DECIMAL(4, 2),

  -- Origine
  source_type VARCHAR(20),                       -- 'depense', 'manuel', 'apport'
  source_id UUID,                                -- id de la dépense liée (le cas échéant)
  fournisseur VARCHAR(200),
  reference_facture VARCHAR(100),

  -- Localisation / affectation
  emplacement VARCHAR(120),
  affecte_a VARCHAR(120),                        -- service, employé...
  numero_serie VARCHAR(100),

  -- Statut
  statut VARCHAR(20) NOT NULL DEFAULT 'en_service'
    CHECK (statut IN ('en_service', 'cede', 'rebut', 'vole_perdu', 'amorti')),
  date_sortie DATE,
  valeur_cession DECIMAL(15, 2),
  motif_sortie TEXT,

  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (entreprise_id, numero_inventaire)
);
CREATE INDEX IF NOT EXISTS idx_immo_entreprise ON immobilisations(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_immo_statut ON immobilisations(entreprise_id, statut);
CREATE INDEX IF NOT EXISTS idx_immo_categorie ON immobilisations(categorie_id);
CREATE INDEX IF NOT EXISTS idx_immo_source ON immobilisations(source_type, source_id);

-- ─── DOTATIONS AUX AMORTISSEMENTS ──────────────────────────────────────────
-- Une dotation = passage en charge sur 1 exercice pour 1 immobilisation.
-- Génère automatiquement une écriture comptable (681 Dotations / 28x Amort).
CREATE TABLE IF NOT EXISTS dotations_amortissement (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  immobilisation_id UUID NOT NULL REFERENCES immobilisations(id) ON DELETE CASCADE,
  exercice_id UUID REFERENCES exercices(id) ON DELETE SET NULL,
  annee INTEGER NOT NULL,
  date_dotation DATE NOT NULL,                   -- en général 31/12
  nb_jours_amortis INTEGER,                      -- prorata temporis (365 par défaut)
  base_amortissable DECIMAL(15, 2) NOT NULL,     -- valeur acquisition − résiduelle
  taux_amortissement DECIMAL(8, 4),              -- taux annuel appliqué
  vnc_debut DECIMAL(15, 2),                      -- valeur nette comptable début d'exercice
  dotation DECIMAL(15, 2) NOT NULL,              -- montant de la dotation
  cumul_amortissements DECIMAL(15, 2) NOT NULL,  -- cumul après cette dotation
  vnc_fin DECIMAL(15, 2) NOT NULL,
  ecriture_id UUID REFERENCES ecritures(id) ON DELETE SET NULL,
  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (immobilisation_id, annee)
);
CREATE INDEX IF NOT EXISTS idx_dotations_entreprise ON dotations_amortissement(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_dotations_immo ON dotations_amortissement(immobilisation_id, annee);
CREATE INDEX IF NOT EXISTS idx_dotations_annee ON dotations_amortissement(entreprise_id, annee);

-- ─── COMPTES SYSCOHADA pour les immobilisations ───────────────────────────
-- Ajout des comptes manquants pour les écritures d'acquisition,
-- d'amortissement et de cession.
INSERT INTO plan_comptable (entreprise_id, numero, libelle, classe, nature, actif)
SELECT e.id, c.numero, c.libelle, c.classe, c.nature, TRUE
FROM entreprises e
CROSS JOIN (VALUES
  -- Classe 2 : Immobilisations
  ('213',  'Logiciels et progiciels',                              2, 'ACTIF'),
  ('215',  'Aménagements & agencements',                           2, 'ACTIF'),
  ('218',  'Autres immobilisations incorporelles',                 2, 'ACTIF'),
  ('22',   'Terrains',                                             2, 'ACTIF'),
  ('231',  'Bâtiments industriels et administratifs',              2, 'ACTIF'),
  ('234',  'Installations techniques',                             2, 'ACTIF'),
  ('241',  'Matériel et outillage industriel',                     2, 'ACTIF'),
  ('2442', 'Matériel et mobilier de bureau',                       2, 'ACTIF'),
  ('2443', 'Matériel informatique',                                2, 'ACTIF'),
  ('2444', 'Mobilier de bureau',                                   2, 'ACTIF'),
  ('245',  'Matériel de transport',                                2, 'ACTIF'),
  ('2461', 'Emballages récupérables',                              2, 'ACTIF'),
  -- Amortissements cumulés (compte 28x — contre-valeur de l'actif)
  ('2813', 'Amortissements des logiciels',                         2, 'PASSIF'),
  ('2815', 'Amortissements des aménagements',                      2, 'PASSIF'),
  ('2818', 'Amortissements autres immo. incorporelles',            2, 'PASSIF'),
  ('2831', 'Amortissements des bâtiments',                         2, 'PASSIF'),
  ('2834', 'Amortissements des installations techniques',          2, 'PASSIF'),
  ('2841', 'Amortissements du matériel et outillage',              2, 'PASSIF'),
  ('28442','Amortissements matériel et mobilier de bureau',        2, 'PASSIF'),
  ('28443','Amortissements matériel informatique',                 2, 'PASSIF'),
  ('28444','Amortissements mobilier de bureau',                    2, 'PASSIF'),
  ('2845', 'Amortissements matériel de transport',                 2, 'PASSIF'),
  -- Dotations aux amortissements (classe 6 — charges)
  ('681',  'Dotations aux amortissements',                         6, 'CHARGE'),
  ('6811', 'Dotations aux amortissements des immo. incorporelles', 6, 'CHARGE'),
  ('6813', 'Dotations aux amortissements des immo. corporelles',   6, 'CHARGE'),
  -- Cessions / sorties d'actif
  ('812',  'Valeurs comptables des cessions d''immo. (charge)',    8, 'CHARGE'),
  ('822',  'Produits des cessions d''immobilisations',             8, 'PRODUIT')
) AS c(numero, libelle, classe, nature)
WHERE NOT EXISTS (
  SELECT 1 FROM plan_comptable pc WHERE pc.entreprise_id = e.id AND pc.numero = c.numero
);

-- ─── JOURNAL DES OPÉRATIONS DIVERSES (si manquant) ─────────────────────────
-- Les dotations et cessions passent par le journal OD.
INSERT INTO journaux (entreprise_id, code, libelle, type)
SELECT e.id, 'OD', 'Journal des opérations diverses', 'OD'
FROM entreprises e
WHERE NOT EXISTS (
  SELECT 1 FROM journaux j WHERE j.entreprise_id = e.id AND j.code = 'OD'
);

-- ─── SEED : catégories d'immobilisation par entreprise ─────────────────────
-- Catégories standard SYSCOHADA avec durées et comptes pré-paramétrés.
INSERT INTO categories_immobilisation
  (entreprise_id, code, libelle, compte_actif, compte_amortissement, compte_dotation,
   duree_annees, methode, amortissable, ordre, systeme)
SELECT e.id, c.code, c.libelle, c.compte_actif, c.compte_amortissement, c.compte_dotation,
       c.duree_annees, c.methode, c.amortissable, c.ordre, TRUE
FROM entreprises e
CROSS JOIN (VALUES
  -- Incorporelles
  ('LOGICIEL',       'Logiciels et progiciels',           '213',   '2813',  '6811',  3,   'lineaire', TRUE,   10),
  ('AMENAGEMENT',    'Aménagements & agencements',        '215',   '2815',  '6813',  10,  'lineaire', TRUE,   20),
  ('FONDS_COMMERCE', 'Fonds de commerce',                 '215',   NULL,    NULL,    0,   'lineaire', FALSE,  21),
  -- Terrains & bâtiments
  ('TERRAIN',        'Terrains',                          '22',    NULL,    NULL,    0,   'lineaire', FALSE,  30),
  ('BATIMENT',       'Bâtiments',                         '231',   '2831',  '6813',  20,  'lineaire', TRUE,   40),
  ('INSTALL_TECH',   'Installations techniques',          '234',   '2834',  '6813',  10,  'lineaire', TRUE,   50),
  -- Matériel
  ('MAT_OUTILLAGE',  'Matériel et outillage industriel',  '241',   '2841',  '6813',  10,  'lineaire', TRUE,   60),
  ('MAT_BUREAU',     'Matériel et mobilier de bureau',    '2442',  '28442', '6813',  5,   'lineaire', TRUE,   70),
  ('MAT_INFO',       'Matériel informatique',             '2443',  '28443', '6813',  3,   'lineaire', TRUE,   80),
  ('MOBILIER',       'Mobilier de bureau',                '2444',  '28444', '6813',  10,  'lineaire', TRUE,   90),
  ('VEHICULE_TOUR',  'Véhicules de tourisme',             '245',   '2845',  '6813',  5,   'lineaire', TRUE,  100),
  ('VEHICULE_UTIL',  'Véhicules utilitaires/camion',      '245',   '2845',  '6813',  4,   'lineaire', TRUE,  101),
  ('EMBALLAGE',      'Emballages récupérables',           '2461',  NULL,    '6813',  3,   'lineaire', TRUE,  110)
) AS c(code, libelle, compte_actif, compte_amortissement, compte_dotation,
       duree_annees, methode, amortissable, ordre)
WHERE NOT EXISTS (
  SELECT 1 FROM categories_immobilisation ci
  WHERE ci.entreprise_id = e.id AND ci.code = c.code
);
