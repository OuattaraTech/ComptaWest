const test = require('node:test');
const assert = require('node:assert/strict');
const {
  planAmortissement, dotationPourAnnee, vncActuelle,
  coefficientDegressifStandard, joursAmortis,
} = require('../src/utils/amortissements');

// ── coefficientDegressifStandard ────────────────────────────────────────────
test('coefficient dégressif : barème CGI CI selon la durée', () => {
  assert.equal(coefficientDegressifStandard(3), 1.5);
  assert.equal(coefficientDegressifStandard(4), 1.5);
  assert.equal(coefficientDegressifStandard(5), 2);
  assert.equal(coefficientDegressifStandard(6), 2);
  assert.equal(coefficientDegressifStandard(10), 2.5);
});

// ── joursAmortis (prorata temporis) ─────────────────────────────────────────
test('joursAmortis : année pleine = 365 jours', () => {
  assert.equal(joursAmortis('2025-01-01', '2025-12-31', '2025-01-01', null), 365);
});

test('joursAmortis : mise en service en cours d\'année = prorata', () => {
  // du 1er juillet au 31 décembre inclus = 184 jours
  assert.equal(joursAmortis('2025-01-01', '2025-12-31', '2025-07-01', null), 184);
});

test('joursAmortis : mise en service après la période = 0', () => {
  assert.equal(joursAmortis('2025-01-01', '2025-12-31', '2026-03-01', null), 0);
});

// ── planAmortissement — linéaire ────────────────────────────────────────────
test('plan linéaire : 1 000 000 sur 5 ans, sans valeur résiduelle', () => {
  const plan = planAmortissement({
    valeur_acquisition: 1000000, valeur_residuelle: 0, duree_annees: 5,
    date_mise_en_service: '2025-01-01', methode: 'lineaire',
  });
  assert.equal(plan.length, 5);
  // Chaque année pleine ≈ 1 000 000 / 5 = 200 000.
  // Note : le moteur calcule un prorata jours/365 — une année bissextile
  // (366 j) donne une dotation très légèrement supérieure (~+0,3 %).
  for (const ligne of plan) {
    assert.ok(Math.abs(ligne.dotation - 200000) < 600, `dotation ≈ 200 000 (obtenu ${ligne.dotation})`);
  }
  // Somme des dotations = base amortissable (ajustement d'arrondi final)
  const somme = plan.reduce((s, l) => s + l.dotation, 0);
  assert.equal(somme, 1000000);
  // VNC finale = valeur résiduelle
  assert.equal(plan[plan.length - 1].vnc_fin, 0);
});

test('plan linéaire : la somme des dotations égale la base amortissable (valeur − résiduelle)', () => {
  const plan = planAmortissement({
    valeur_acquisition: 28000000, valeur_residuelle: 4000000, duree_annees: 4,
    date_mise_en_service: '2023-06-15', methode: 'lineaire',
  });
  const somme = plan.reduce((s, l) => s + l.dotation, 0);
  assert.equal(somme, 24000000);                       // 28M − 4M
  assert.equal(plan[plan.length - 1].vnc_fin, 4000000); // se termine à la résiduelle
});

test('plan : cumul strictement croissant et VNC décroissante', () => {
  const plan = planAmortissement({
    valeur_acquisition: 5000000, valeur_residuelle: 0, duree_annees: 8,
    date_mise_en_service: '2024-03-01', methode: 'lineaire',
  });
  for (let i = 1; i < plan.length; i++) {
    assert.ok(plan[i].cumul_amortissements > plan[i - 1].cumul_amortissements, 'cumul croissant');
    assert.ok(plan[i].vnc_fin < plan[i - 1].vnc_fin, 'VNC décroissante');
  }
  // Aucune dotation ne fait passer la VNC sous la valeur résiduelle
  for (const l of plan) assert.ok(l.vnc_fin >= 0);
});

// ── planAmortissement — dégressif ───────────────────────────────────────────
test('plan dégressif : somme des dotations = base, fin à la valeur résiduelle', () => {
  const plan = planAmortissement({
    valeur_acquisition: 10000000, valeur_residuelle: 0, duree_annees: 5,
    date_mise_en_service: '2025-01-01', methode: 'degressif', coefficient_degressif: 2,
  });
  assert.ok(plan.length > 0);
  const somme = plan.reduce((s, l) => s + l.dotation, 0);
  assert.ok(Math.abs(somme - 10000000) < 1, `somme dotations ≈ base (obtenu ${somme})`);
  assert.ok(plan.every(l => l.dotation > 0), 'toutes les dotations sont positives');
});

// ── Cas limites ─────────────────────────────────────────────────────────────
test('plan : durée nulle ou valeur nulle → plan vide', () => {
  assert.deepEqual(planAmortissement({ valeur_acquisition: 1000000, duree_annees: 0 }), []);
  assert.deepEqual(planAmortissement({ valeur_acquisition: 0, duree_annees: 5, date_mise_en_service: '2025-01-01' }), []);
});

// ── vncActuelle ─────────────────────────────────────────────────────────────
test('vncActuelle : valeur d\'acquisition moins le cumul des dotations passées', () => {
  const vnc = vncActuelle(
    { valeur_acquisition: 1000000 },
    [{ dotation: 200000 }, { dotation: 200000 }],
  );
  assert.equal(vnc, 600000);
});

// ── dotationPourAnnee ───────────────────────────────────────────────────────
test('dotationPourAnnee : retourne la ligne du plan pour l\'année demandée', () => {
  const immo = {
    valeur_acquisition: 1000000, valeur_residuelle: 0, duree_annees: 5,
    date_mise_en_service: '2025-01-01', methode: 'lineaire',
  };
  assert.equal(dotationPourAnnee(immo, 2026).dotation, 200000);
  assert.equal(dotationPourAnnee(immo, 2099), null);
});
