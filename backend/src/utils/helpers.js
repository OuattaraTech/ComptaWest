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

module.exports = { creerCategoriesDefaut };
