const { PLAN_COMPTABLE, JOURNAUX_DEFAUT } = require('../data/plan_comptable_syscohada');

/**
 * Crée le plan comptable SYSCOHADA Révisé complet (~800 comptes) pour une entreprise.
 * Idempotent : si certains comptes existent déjà, ils sont conservés.
 */
const creerPlanComptableSyscohada = async (entrepriseId, client) => {
  // INSERT en lot via VALUES multi-lignes pour éviter ~800 round-trips réseau
  const CHUNK = 100;
  for (let i = 0; i < PLAN_COMPTABLE.length; i += CHUNK) {
    const chunk = PLAN_COMPTABLE.slice(i, i + CHUNK);
    const valuesClauses = [];
    const params = [];
    chunk.forEach(([numero, libelle, classe, nature, est_lettrable]) => {
      const base = params.length;
      // parent_numero = préfixe à 1 caractère de moins (ex : 6011 → 601, 411 → 41, 41 → null)
      const parent = numero.length > 1 ? numero.slice(0, -1) : null;
      params.push(entrepriseId, numero, libelle, classe, nature, est_lettrable, parent);
      valuesClauses.push(
        `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, true, $${base+6}, $${base+7})`
      );
    });
    await client.query(
      `INSERT INTO plan_comptable
         (entreprise_id, numero, libelle, classe, nature, est_systeme, est_lettrable, parent_numero)
       VALUES ${valuesClauses.join(',')}
       ON CONFLICT (entreprise_id, numero) DO NOTHING`,
      params
    );
  }
};

/**
 * Crée les 7 journaux comptables par défaut (VTE, ACH, BNK, CAI, MM, OD, AN).
 */
const creerJournauxDefaut = async (entrepriseId, client) => {
  for (const j of JOURNAUX_DEFAUT) {
    await client.query(
      `INSERT INTO journaux (entreprise_id, code, libelle, type, compte_contrepartie, est_systeme)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (entreprise_id, code) DO NOTHING`,
      [entrepriseId, j.code, j.libelle, j.type, j.compte_contrepartie]
    );
  }
};

/**
 * Crée l'exercice comptable courant (année civile en cours) si aucun n'existe.
 */
const creerExerciceCourant = async (entrepriseId, client) => {
  const annee = new Date().getFullYear();
  await client.query(
    `INSERT INTO exercices (entreprise_id, libelle, date_debut, date_fin)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (entreprise_id, date_debut, date_fin) DO NOTHING`,
    [entrepriseId, `Exercice ${annee}`, `${annee}-01-01`, `${annee}-12-31`]
  );
};

/**
 * Crée les 10 catégories SYSCOHADA par défaut pour une entreprise.
 * Utilisé à la création d'entreprise (register + createEntreprise).
 */
const creerCategoriesDefaut = async (entrepriseId, client) => {
  const cats = [
    ['Achats de marchandises',    '60',  '#4E8BF5'],
    ['Transports',                '61',  '#F5A623'],
    ['Services extérieurs',       '62',  '#00D4AA'],
    ['Impôts & taxes',            '63',  '#FF5C6B'],
    ['Charges de personnel',      '66',  '#A855F7'],
    ['Loyer & charges locatives', '62L', '#EC4899'],
    ['Télécommunications',        '62T', '#06B6D4'],
    ['Équipements & matériel',    '24',  '#84CC16'],
    ['Charges financières',       '67',  '#F97316'],
    ['Autres charges',            '65',  '#6B7A99'],
  ];
  for (const [nom, code, couleur] of cats) {
    await client.query(
      `INSERT INTO categories_depenses (entreprise_id, nom, code, couleur, est_systeme)
       VALUES ($1, $2, $3, $4, true)`,
      [entrepriseId, nom, code, couleur]
    );
  }
};

/**
 * Crée les rubriques de paie par défaut pour une nouvelle entreprise.
 * Reprend la même liste que la migration 005 + 024 (corrections CI) :
 *   - HS_* exonérées d'ITS (Code CGI CI art. 116)
 *   - IND_LOGEMENT soumis aux deux (ITS + CNPS)
 *   - PRIME_TRANSPORT exonéré sous 30 000 (plafond géré côté moteur)
 *   - Avantages en nature en mode forfait DGI
 *
 * La migration 005 ne traite que les entreprises existantes au moment
 * de son application (CROSS JOIN), donc TOUTE entreprise créée après
 * (compte démo, register, multi-entreprises) doit appeler ce helper.
 *
 * Idempotent grâce au NOT EXISTS sur (entreprise_id, code).
 */
const creerRubriquesPaieDefaut = async (entrepriseId, client) => {
  await client.query(`
    INSERT INTO rubriques_paie (entreprise_id, code, libelle, type, imposable_its, cotisable_cnps, nature, valeur_defaut, base_calcul, compte_pc_numero, ordre, systeme)
    SELECT $1, r.code, r.libelle, r.type, r.imposable_its, r.cotisable_cnps, r.nature, r.valeur_defaut, r.base_calcul, r.compte_pc_numero, r.ordre, TRUE
    FROM (VALUES
      -- Gains imposables
      ('SALAIRE_BASE',     'Salaire de base',           'gain',    TRUE,  TRUE,  'fixe',       0,    NULL,           '661',  10),
      ('SURSALAIRE',       'Sursalaire',                'gain',    TRUE,  TRUE,  'fixe',       0,    NULL,           '661',  20),
      ('PRIME_ANCIENNETE', 'Prime d''ancienneté',       'gain',    TRUE,  TRUE,  'pourcentage', 0,   'salaire_base', '661',  30),
      ('PRIME_RENDEMENT',  'Prime de rendement',        'gain',    TRUE,  TRUE,  'fixe',       0,    NULL,           '661',  40),
      -- Heures sup : exonérées ITS (CGI CI art. 116), gardent CNPS
      ('HS_15',            'Heures sup 15%',            'gain',    FALSE, TRUE,  'variable',   1.15, 'horaire',      '661',  50),
      ('HS_50',            'Heures sup 50%',            'gain',    FALSE, TRUE,  'variable',   1.5,  'horaire',      '661',  51),
      ('HS_75',            'Heures sup 75% (nuit)',     'gain',    FALSE, TRUE,  'variable',   1.75, 'horaire',      '661',  52),
      ('HS_100',           'Heures sup 100% (dim/férié)','gain',   FALSE, TRUE,  'variable',   2.0,  'horaire',      '661',  53),
      -- Indemnité logement espèces : ITS + CNPS
      ('IND_LOGEMENT',     'Indemnité de logement',     'gain',    TRUE,  TRUE,  'fixe',       0,    NULL,           '661',  60),
      -- Prime transport : exonérée jusqu'à 30 000 (plafond côté moteur)
      ('PRIME_TRANSPORT',  'Prime de transport (exonérée jusqu''à 30 000 FCFA/mois)', 'gain', FALSE, FALSE, 'fixe', 30000, NULL, '661', 70),
      ('IND_FRAIS_PRO',    'Indemnité frais professionnels', 'gain', FALSE, FALSE, 'fixe',     0,    NULL,           '661',  71),
      -- Retenues
      ('AVANCE',           'Avance sur salaire',        'retenue', FALSE, FALSE, 'fixe',       0,    NULL,           '425',  80),
      ('PRET_EMPLOYEUR',   'Remboursement prêt',        'retenue', FALSE, FALSE, 'fixe',       0,    NULL,           '425',  81),
      ('SAISIE',           'Saisie arrêt',              'retenue', FALSE, FALSE, 'fixe',       0,    NULL,           '425',  82),
      -- Avantages en nature (forfait DGI)
      ('AVN_LOGEMENT',     'Avantage logement — saisir le forfait DGI', 'info', TRUE, TRUE, 'fixe', 0, NULL, NULL, 90),
      ('AVN_VOITURE',      'Avantage voiture — saisir le forfait DGI',  'info', TRUE, TRUE, 'fixe', 0, NULL, NULL, 91)
    ) AS r(code, libelle, type, imposable_its, cotisable_cnps, nature, valeur_defaut, base_calcul, compte_pc_numero, ordre)
    WHERE NOT EXISTS (
      SELECT 1 FROM rubriques_paie rp WHERE rp.entreprise_id = $1 AND rp.code = r.code
    )
  `, [entrepriseId]).catch(err => {
    // Skip silencieux si la table n'existe pas (migration 005 absente)
    if (err.code !== '42P01') throw err;
  });
};

module.exports = {
  creerCategoriesDefaut,
  creerPlanComptableSyscohada,
  creerJournauxDefaut,
  creerExerciceCourant,
  creerRubriquesPaieDefaut,
};
