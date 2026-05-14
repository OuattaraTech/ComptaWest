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

module.exports = {
  creerCategoriesDefaut,
  creerPlanComptableSyscohada,
  creerJournauxDefaut,
  creerExerciceCourant,
};
