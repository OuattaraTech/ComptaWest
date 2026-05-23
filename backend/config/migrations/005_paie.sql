-- ============================================================================
-- MIGRATION 005 : PAIE SYSCOHADA — Côte d'Ivoire
-- ============================================================================
-- Objectif : gestion complète du personnel et de la paie conformément au
-- Code du Travail CI et au Code Général des Impôts (régime ITS/CN).
-- ============================================================================

-- ─── EMPLOYÉS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  matricule VARCHAR(30) NOT NULL,                  -- unique par entreprise

  -- État civil
  civilite VARCHAR(10),                            -- M., Mme, Mlle
  nom VARCHAR(120) NOT NULL,
  prenoms VARCHAR(120),
  date_naissance DATE,
  lieu_naissance VARCHAR(120),
  sexe VARCHAR(1) CHECK (sexe IN ('M', 'F')),
  nationalite VARCHAR(80) DEFAULT 'Ivoirienne',
  situation_matrimoniale VARCHAR(20) CHECK (situation_matrimoniale IN ('celibataire', 'marie', 'divorce', 'veuf')),
  nb_conjoints INTEGER DEFAULT 0,                  -- 0 ou 1 pour parts fiscales
  nb_enfants_charge INTEGER DEFAULT 0,             -- pour parts fiscales (plafonné à 6 enfants en CI)
  cni VARCHAR(50),                                 -- n° carte nationale d'identité

  -- Contact
  adresse VARCHAR(255),
  telephone VARCHAR(30),
  email VARCHAR(150),

  -- Contrat
  poste VARCHAR(120),
  departement VARCHAR(120),
  date_embauche DATE NOT NULL,
  type_contrat VARCHAR(20) NOT NULL DEFAULT 'CDI'
    CHECK (type_contrat IN ('CDI', 'CDD', 'stage', 'prestation', 'apprentissage')),
  date_fin_contrat DATE,
  duree_essai_mois INTEGER DEFAULT 3,
  convention_collective VARCHAR(120),
  categorie_professionnelle VARCHAR(50),           -- ex : 'cadre', 'agent_maitrise', 'employe', 'ouvrier'

  -- Rémunération
  salaire_base DECIMAL(15, 2) NOT NULL DEFAULT 0,
  taux_horaire DECIMAL(10, 2),                     -- pour les heures sup
  mode_paiement VARCHAR(20) DEFAULT 'virement'
    CHECK (mode_paiement IN ('virement', 'cash', 'cheque', 'mobile_money')),
  compte_tresorerie_id UUID REFERENCES comptes_tresorerie(id) ON DELETE SET NULL,
  banque VARCHAR(120),
  rib VARCHAR(50),                                 -- IBAN ou n° de compte
  numero_mobile_money VARCHAR(30),                 -- si paiement par mobile money

  -- Sécurité sociale
  numero_cnps VARCHAR(30),                         -- n° CNPS Côte d'Ivoire
  numero_cmu VARCHAR(30),                          -- n° Couverture Maladie Universelle
  taux_at_personnel DECIMAL(5, 2),                 -- taux AT spécifique (sinon hérité de l'entreprise)

  -- Statut
  actif BOOLEAN DEFAULT TRUE,
  date_depart DATE,
  motif_depart VARCHAR(100),                       -- 'demission', 'licenciement', 'fin_cdd', 'retraite', etc.
  archived_at TIMESTAMP,

  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (entreprise_id, matricule)
);

CREATE INDEX IF NOT EXISTS idx_employes_entreprise ON employes(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_employes_actif ON employes(entreprise_id, actif) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employes_matricule ON employes(entreprise_id, matricule);

-- ─── RUBRIQUES DE PAIE (catalogue paramétrable) ────────────────────────────
-- Permet de définir des éléments de salaire personnalisés au-delà du salaire
-- de base : primes, indemnités, retenues, avances, etc.
CREATE TABLE IF NOT EXISTS rubriques_paie (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,                       -- ex : 'PRIME_TRANSPORT', 'HS_50', 'AVANCE'
  libelle VARCHAR(120) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'gain',                  -- ajoute au brut (prime, indemnité, sursalaire, HS…)
    'retenue',               -- retire du net (avance, prêt employeur, saisie…)
    'cotisation_salariale',  -- cotisation à charge du salarié (déjà calculée pour CNPS)
    'cotisation_patronale',  -- cotisation à charge de l'employeur
    'info'                   -- ligne informative (avantage en nature non monétaire)
  )),
  imposable_its BOOLEAN DEFAULT TRUE,              -- entre dans la base imposable ITS
  cotisable_cnps BOOLEAN DEFAULT TRUE,             -- entre dans la base CNPS
  nature VARCHAR(20) DEFAULT 'fixe' CHECK (nature IN ('fixe', 'variable', 'pourcentage', 'formule')),
  valeur_defaut DECIMAL(15, 2) DEFAULT 0,          -- montant ou taux par défaut
  base_calcul VARCHAR(30),                         -- 'salaire_base', 'brut', 'horaire' pour les % et formules
  compte_pc_numero VARCHAR(20),                    -- compte SYSCOHADA pour l'écriture
  ordre INTEGER DEFAULT 100,
  actif BOOLEAN DEFAULT TRUE,
  systeme BOOLEAN DEFAULT FALSE,                   -- rubriques système (non supprimables)
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (entreprise_id, code)
);

CREATE INDEX IF NOT EXISTS idx_rubriques_entreprise ON rubriques_paie(entreprise_id, actif);

-- ─── BULLETINS DE PAIE ─────────────────────────────────────────────────────
-- Un bulletin par employé et par mois. La paie d'un employé sur un même mois
-- ne peut pas être éditée plusieurs fois (UNIQUE).
CREATE TABLE IF NOT EXISTS bulletins_paie (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  employe_id UUID NOT NULL REFERENCES employes(id) ON DELETE RESTRICT,

  -- Période
  annee INTEGER NOT NULL,
  mois INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
  periode_debut DATE NOT NULL,
  periode_fin DATE NOT NULL,
  jours_travailles DECIMAL(5, 2) DEFAULT 30,

  -- Snapshot employé (au moment de l'édition — gel pour traçabilité)
  matricule VARCHAR(30),
  nom_complet VARCHAR(250),
  poste VARCHAR(120),
  salaire_base DECIMAL(15, 2),
  nb_parts DECIMAL(4, 2),

  -- Totaux calculés
  brut_total DECIMAL(15, 2) DEFAULT 0,
  total_cotisations_salariales DECIMAL(15, 2) DEFAULT 0,
  salaire_imposable DECIMAL(15, 2) DEFAULT 0,
  total_impots DECIMAL(15, 2) DEFAULT 0,
  total_retenues DECIMAL(15, 2) DEFAULT 0,           -- avances, prêts, saisies hors impôts
  total_gains DECIMAL(15, 2) DEFAULT 0,              -- primes, HS, indemnités
  net_a_payer DECIMAL(15, 2) DEFAULT 0,
  total_cotisations_patronales DECIMAL(15, 2) DEFAULT 0,
  cout_total_employeur DECIMAL(15, 2) DEFAULT 0,

  -- Statut & traçabilité
  statut VARCHAR(20) NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon', 'valide', 'paye', 'annule')),
  date_validation TIMESTAMP,
  valide_par UUID REFERENCES utilisateurs(id),
  date_paiement DATE,
  compte_tresorerie_id UUID REFERENCES comptes_tresorerie(id) ON DELETE SET NULL,
  mouvement_tresorerie_id UUID REFERENCES mouvements_tresorerie(id) ON DELETE SET NULL,
  ecriture_id UUID REFERENCES ecritures(id) ON DELETE SET NULL,

  notes TEXT,
  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (entreprise_id, employe_id, annee, mois)
);

CREATE INDEX IF NOT EXISTS idx_bulletins_entreprise ON bulletins_paie(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_periode ON bulletins_paie(entreprise_id, annee, mois);
CREATE INDEX IF NOT EXISTS idx_bulletins_employe ON bulletins_paie(employe_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_statut ON bulletins_paie(entreprise_id, statut);

-- ─── LIGNES DE BULLETIN ────────────────────────────────────────────────────
-- Détail de chaque rubrique appliquée sur un bulletin. Conserve le libellé
-- et le montant figés pour traçabilité (snapshot).
CREATE TABLE IF NOT EXISTS lignes_bulletin (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bulletin_id UUID NOT NULL REFERENCES bulletins_paie(id) ON DELETE CASCADE,
  rubrique_id UUID REFERENCES rubriques_paie(id) ON DELETE SET NULL,

  code VARCHAR(20),                                -- snapshot
  libelle VARCHAR(120) NOT NULL,                   -- snapshot
  type VARCHAR(30) NOT NULL,                       -- snapshot
  base DECIMAL(15, 2),                             -- base de calcul (ex : brut, salaire_base)
  taux DECIMAL(8, 4),                              -- taux en %
  montant DECIMAL(15, 2) NOT NULL DEFAULT 0,
  est_patronale BOOLEAN DEFAULT FALSE,             -- cotisation patronale (informative côté employé)
  ordre INTEGER DEFAULT 100,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lignes_bulletin ON lignes_bulletin(bulletin_id, ordre);

-- ─── SEED : rubriques de paie par défaut pour chaque entreprise ───────────
-- Ces rubriques sont "système" : non supprimables, modifiables seulement
-- pour les taux/valeurs. Elles couvrent les cas standards d'une PME CI.
INSERT INTO rubriques_paie (entreprise_id, code, libelle, type, imposable_its, cotisable_cnps, nature, valeur_defaut, base_calcul, compte_pc_numero, ordre, systeme)
SELECT e.id, r.code, r.libelle, r.type, r.imposable_its, r.cotisable_cnps, r.nature, r.valeur_defaut, r.base_calcul, r.compte_pc_numero, r.ordre, TRUE
FROM entreprises e
CROSS JOIN (VALUES
  -- Gains imposables
  ('SALAIRE_BASE',     'Salaire de base',           'gain',    TRUE,  TRUE,  'fixe',       0,    NULL,           '661',  10),
  ('SURSALAIRE',       'Sursalaire',                'gain',    TRUE,  TRUE,  'fixe',       0,    NULL,           '661',  20),
  ('PRIME_ANCIENNETE', 'Prime d''ancienneté',       'gain',    TRUE,  TRUE,  'pourcentage', 0,   'salaire_base', '661',  30),
  ('PRIME_RENDEMENT',  'Prime de rendement',        'gain',    TRUE,  TRUE,  'fixe',       0,    NULL,           '661',  40),
  -- Heures sup : exonérées d'ITS en CI (art. 116 CGI CI), restent
  -- soumises CNPS. Confirmé par audit fiscal mai 2026.
  ('HS_15',            'Heures sup 15%',            'gain',    FALSE, TRUE,  'variable',   1.15, 'horaire',      '661',  50),
  ('HS_50',            'Heures sup 50%',            'gain',    FALSE, TRUE,  'variable',   1.5,  'horaire',      '661',  51),
  ('HS_75',            'Heures sup 75% (nuit)',     'gain',    FALSE, TRUE,  'variable',   1.75, 'horaire',      '661',  52),
  ('HS_100',           'Heures sup 100% (dimanche/férié)', 'gain', FALSE, TRUE, 'variable',  2.0,  'horaire',      '661',  53),
  -- Indemnité logement en espèces : soumise ITS ET CNPS (CGI CI).
  ('IND_LOGEMENT',     'Indemnité de logement',     'gain',    TRUE,  TRUE,  'fixe',       0,    NULL,           '661',  60),
  -- Prime transport : exonération limitée à 30 000 FCFA/mois — le plafond
  -- est appliqué côté moteur de calcul (utils/paie-ci.js). Le surplus
  -- éventuel est ajouté aux assiettes ITS et CNPS automatiquement.
  ('PRIME_TRANSPORT',  'Prime de transport (exonérée jusqu''à 30 000 FCFA/mois)', 'gain', FALSE, FALSE, 'fixe', 30000, NULL, '661', 70),
  ('IND_FRAIS_PRO',    'Indemnité frais professionnels', 'gain', FALSE, FALSE, 'fixe',     0,    NULL,           '661',  71),
  -- Retenues (avances, prêts)
  ('AVANCE',           'Avance sur salaire',        'retenue', FALSE, FALSE, 'fixe',       0,    NULL,           '425',  80),
  ('PRET_EMPLOYEUR',   'Remboursement prêt',        'retenue', FALSE, FALSE, 'fixe',       0,    NULL,           '425',  81),
  ('SAISIE',           'Saisie arrêt',              'retenue', FALSE, FALSE, 'fixe',       0,    NULL,           '425',  82),
  -- Avantages en nature : la base à saisir DOIT être le forfait DGI,
  -- pas la valeur réelle. Voir migration 024 et UI Paramètres → Paie.
  ('AVN_LOGEMENT',     'Avantage logement — saisir le forfait DGI', 'info', TRUE, TRUE, 'fixe', 0, NULL, NULL, 90),
  ('AVN_VOITURE',      'Avantage voiture — saisir le forfait DGI',  'info', TRUE, TRUE, 'fixe', 0, NULL, NULL, 91)
) AS r(code, libelle, type, imposable_its, cotisable_cnps, nature, valeur_defaut, base_calcul, compte_pc_numero, ordre)
WHERE NOT EXISTS (
  SELECT 1 FROM rubriques_paie rp WHERE rp.entreprise_id = e.id AND rp.code = r.code
);

-- ─── COMPTES SYSCOHADA pour la paie (si manquants dans le plan comptable) ──
-- Ces comptes sont nécessaires pour les écritures comptables de paie.
INSERT INTO plan_comptable (entreprise_id, numero, libelle, classe, nature, actif)
SELECT e.id, c.numero, c.libelle, c.classe, c.nature, TRUE
FROM entreprises e
CROSS JOIN (VALUES
  ('661',  'Frais de personnel',                                 6, 'CHARGE'),
  ('6611', 'Salaires bruts',                                     6, 'CHARGE'),
  ('6612', 'Primes et indemnités',                               6, 'CHARGE'),
  ('664',  'Charges sociales',                                   6, 'CHARGE'),
  ('6641', 'Charges sociales — CNPS retraite (patronal)',        6, 'CHARGE'),
  ('6642', 'Charges sociales — CNPS prestations familiales',     6, 'CHARGE'),
  ('6643', 'Charges sociales — CNPS accident du travail',        6, 'CHARGE'),
  ('6644', 'Charges sociales — FDFP / apprentissage',            6, 'CHARGE'),
  ('421',  'Personnel — Rémunérations dues',                     4, 'PASSIF'),
  ('425',  'Personnel — Avances et acomptes',                    4, 'ACTIF'),
  ('431',  'Sécurité sociale (CNPS)',                            4, 'PASSIF'),
  ('432',  'Caisse retraite complémentaire',                     4, 'PASSIF'),
  ('447',  'État — Impôts retenus à la source (ITS, CN, CRN)',   4, 'PASSIF')
) AS c(numero, libelle, classe, nature)
WHERE NOT EXISTS (
  SELECT 1 FROM plan_comptable pc WHERE pc.entreprise_id = e.id AND pc.numero = c.numero
);

-- ─── JOURNAL DE PAIE (si manquant) ─────────────────────────────────────────
INSERT INTO journaux (entreprise_id, code, libelle, type)
SELECT e.id, 'PAI', 'Journal de paie', 'OD'
FROM entreprises e
WHERE NOT EXISTS (
  SELECT 1 FROM journaux j WHERE j.entreprise_id = e.id AND j.code = 'PAI'
);
