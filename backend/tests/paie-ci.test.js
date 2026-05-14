const test = require('node:test');
const assert = require('node:assert/strict');
const { calculerParts, calculerBulletin } = require('../src/utils/paie-ci');

const round2 = (n) => Math.round(n * 100) / 100;

// ── calculerParts (quotient familial CI) ────────────────────────────────────
test('parts : célibataire sans enfant = 1 part', () => {
  assert.equal(calculerParts({ situation_matrimoniale: 'celibataire' }), 1);
});

test('parts : marié avec conjoint = 2 parts', () => {
  assert.equal(calculerParts({ situation_matrimoniale: 'marie', nb_conjoints: 1 }), 2);
});

test('parts : marié sans conjoint déclaré reste à 1 part', () => {
  // le code exige nb_conjoints > 0 pour accorder la 2e part
  assert.equal(calculerParts({ situation_matrimoniale: 'marie', nb_conjoints: 0 }), 1);
});

test('parts : +0,5 part par enfant à charge', () => {
  assert.equal(calculerParts({ situation_matrimoniale: 'marie', nb_conjoints: 1, nb_enfants_charge: 2 }), 3);
  assert.equal(calculerParts({ situation_matrimoniale: 'celibataire', nb_enfants_charge: 3 }), 2.5);
});

test('parts : monotone — plus d\'enfants ne réduit jamais le nombre de parts', () => {
  let prec = 0;
  for (let n = 0; n <= 8; n++) {
    const p = calculerParts({ situation_matrimoniale: 'marie', nb_conjoints: 1, nb_enfants_charge: n });
    assert.ok(p >= prec, `parts non décroissantes (${n} enfants)`);
    prec = p;
  }
});

// ── calculerBulletin — identités comptables (doivent TOUJOURS tenir) ────────
test('bulletin : net = brut − cotisations salariales − impôts − retenues', () => {
  const b = calculerBulletin({ employe: { salaire_base: 300000, situation_matrimoniale: 'celibataire' } });
  const attendu = round2(b.brut_total - b.total_cotisations_salariales - b.total_impots - b.total_retenues);
  assert.equal(b.net_a_payer, attendu);
});

test('bulletin : coût employeur = brut + cotisations patronales', () => {
  const b = calculerBulletin({ employe: { salaire_base: 450000, situation_matrimoniale: 'marie', nb_conjoints: 1 } });
  assert.equal(b.cout_total_employeur, round2(b.brut_total + b.total_cotisations_patronales));
});

test('bulletin : le net est positif et inférieur au brut', () => {
  const b = calculerBulletin({ employe: { salaire_base: 250000, situation_matrimoniale: 'celibataire' } });
  assert.ok(b.net_a_payer > 0, 'net positif');
  assert.ok(b.net_a_payer < b.brut_total, 'net < brut');
});

test('bulletin : cotisations et impôts jamais négatifs', () => {
  const b = calculerBulletin({ employe: { salaire_base: 180000, situation_matrimoniale: 'celibataire' } });
  assert.ok(b.total_cotisations_salariales >= 0);
  assert.ok(b.total_cotisations_patronales >= 0);
  assert.ok(b.total_impots >= 0);
});

test('bulletin : la somme des lignes de cotisation égale les totaux', () => {
  const b = calculerBulletin({ employe: { salaire_base: 600000, situation_matrimoniale: 'marie', nb_conjoints: 1, nb_enfants_charge: 2 } });
  // NB : la ligne ITS porte le type 'cotisation_salariale' (faute de type 'impot'
  // dans le modèle de rubriques) mais son montant est compté dans total_impots.
  // La somme des lignes 'cotisation_salariale' = cotisations sociales + impôts.
  const sommeSal = round2(b.lignes.filter(l => l.type === 'cotisation_salariale').reduce((s, l) => s + l.montant, 0));
  const sommePat = round2(b.lignes.filter(l => l.type === 'cotisation_patronale').reduce((s, l) => s + l.montant, 0));
  assert.equal(sommeSal, round2(b.total_cotisations_salariales + b.total_impots));
  assert.equal(sommePat, b.total_cotisations_patronales);
});

test('bulletin : un salaire plus élevé produit un net plus élevé', () => {
  const bas  = calculerBulletin({ employe: { salaire_base: 200000, situation_matrimoniale: 'celibataire' } });
  const haut = calculerBulletin({ employe: { salaire_base: 800000, situation_matrimoniale: 'celibataire' } });
  assert.ok(haut.net_a_payer > bas.net_a_payer);
});

test('bulletin : une prime (rubrique gain) augmente le brut du montant de la prime', () => {
  const sansPrime = calculerBulletin({ employe: { salaire_base: 300000, situation_matrimoniale: 'celibataire' } });
  const avecPrime = calculerBulletin({
    employe: { salaire_base: 300000, situation_matrimoniale: 'celibataire' },
    rubriques: [{ code: 'PRIME', libelle: 'Prime', type: 'gain', montant: 50000, imposable_its: true, cotisable_cnps: true }],
  });
  assert.equal(avecPrime.brut_total, sansPrime.brut_total + 50000);
});

// ── Valeurs repères (régression — figées sur le moteur actuel) ──────────────
// Si ces chiffres changent, c'est que le calcul de paie a été modifié :
// vérifier que c'est intentionnel et conforme au barème CI en vigueur.
test('bulletin repère : salaire de base 300 000 FCFA, célibataire', () => {
  const b = calculerBulletin({ employe: { salaire_base: 300000, situation_matrimoniale: 'celibataire' } });
  assert.equal(b.brut_total, 300000);
  assert.equal(b.nb_parts, 1);
  assert.equal(b.total_cotisations_salariales, 19900);
  assert.equal(b.total_impots, 21612);
  assert.equal(b.net_a_payer, 258488);
  assert.equal(b.total_cotisations_patronales, 33325);
  assert.equal(b.cout_total_employeur, 333325);
});

// ── Cas limite ──────────────────────────────────────────────────────────────
test('bulletin : salaire de base 0 ne provoque pas d\'erreur', () => {
  const b = calculerBulletin({ employe: { salaire_base: 0, situation_matrimoniale: 'celibataire' } });
  assert.equal(b.brut_total, 0);
  // Le net peut être légèrement négatif à brut 0 car la CMU est un forfait
  // fixe (1 000 FCFA) prélevé indépendamment du salaire. Cas non réaliste
  // (un employé a toujours un salaire), on vérifie surtout l'absence de crash.
  assert.ok(Number.isFinite(b.net_a_payer), 'net_a_payer est un nombre fini');
});
