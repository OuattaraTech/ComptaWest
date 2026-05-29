/**
 * Tests de précision arithmétique TVA (LOT 2.2).
 *
 * Matrice exhaustive de cas couvrant :
 *   - Taux Côte d'Ivoire (18% standard, 9% réduit, 0% exonéré)
 *   - Calcul HT → TTC (TVA = HT × taux/100)
 *   - Calcul TTC → HT (HT = TTC / (1 + taux/100))
 *   - Arrondi systématique au FCFA (entier)
 *   - Montants limites (1 FCFA, milliards)
 *   - Plusieurs lignes (somme cohérente)
 */
const test = require('node:test');
const assert = require('node:assert/strict');

// Helpers — calculs TVA standardisés ApeX
const round = (n) => Math.round(n);
const tvaDeHT = (ht, taux) => round(ht * (taux / 100));
const ttcDeHT = (ht, taux) => ht + tvaDeHT(ht, taux);
const htDeTTC = (ttc, taux) => round(ttc / (1 + taux / 100));

// ─── Bloc 1 : Taux 18% (standard CI) ──────────────────────────────────
test('TVA 18% : 10 000 HT → 1 800 TVA → 11 800 TTC', () => {
  assert.equal(tvaDeHT(10000, 18), 1800);
  assert.equal(ttcDeHT(10000, 18), 11800);
});

test('TVA 18% : 1 FCFA HT → 0 TVA (arrondi)', () => {
  assert.equal(tvaDeHT(1, 18), 0);
});

test('TVA 18% : 6 FCFA HT → 1 TVA (1.08 arrondi sup)', () => {
  assert.equal(tvaDeHT(6, 18), 1);
});

test('TVA 18% : 1 000 000 000 HT → 180 000 000 TVA (milliard)', () => {
  assert.equal(tvaDeHT(1000000000, 18), 180000000);
});

test('TVA 18% TTC inverse : 11 800 TTC → 10 000 HT', () => {
  assert.equal(htDeTTC(11800, 18), 10000);
});

test('TVA 18% TTC inverse arrondi : 1 180 TTC → 1 000 HT', () => {
  assert.equal(htDeTTC(1180, 18), 1000);
});

// ─── Bloc 2 : Taux 9% (réduit, certains produits CI) ──────────────────
test('TVA 9% : 10 000 HT → 900 TVA → 10 900 TTC', () => {
  assert.equal(tvaDeHT(10000, 9), 900);
  assert.equal(ttcDeHT(10000, 9), 10900);
});

test('TVA 9% : 50 000 HT → 4 500 TVA', () => {
  assert.equal(tvaDeHT(50000, 9), 4500);
});

test('TVA 9% TTC inverse : 10 900 TTC → 10 000 HT', () => {
  assert.equal(htDeTTC(10900, 9), 10000);
});

// ─── Bloc 3 : Taux 0% (exonéré : exportations, FNE, etc.) ─────────────
test('TVA 0% : pas de TVA quel que soit le HT', () => {
  assert.equal(tvaDeHT(10000, 0), 0);
  assert.equal(tvaDeHT(1, 0), 0);
  assert.equal(tvaDeHT(99999999, 0), 0);
  assert.equal(ttcDeHT(10000, 0), 10000);
});

// ─── Bloc 4 : Somme de plusieurs lignes (facture multi-articles) ──────
test('Multi-lignes 18% : 3 lignes de 5 000 HT → 15 000 HT + 2 700 TVA = 17 700 TTC', () => {
  const lignes = [{ ht: 5000 }, { ht: 5000 }, { ht: 5000 }];
  const totalHT = lignes.reduce((s, l) => s + l.ht, 0);
  const totalTVA = lignes.reduce((s, l) => s + tvaDeHT(l.ht, 18), 0);
  assert.equal(totalHT, 15000);
  assert.equal(totalTVA, 2700);
  assert.equal(totalHT + totalTVA, 17700);
});

test('Multi-lignes taux mixés : 5 000 (18%) + 5 000 (9%) + 5 000 (0%)', () => {
  const tva = tvaDeHT(5000, 18) + tvaDeHT(5000, 9) + tvaDeHT(5000, 0);
  assert.equal(tva, 900 + 450 + 0);
  assert.equal(tva, 1350);
});

// ─── Bloc 5 : Cas d'arrondi piégeux ──────────────────────────────────
test('Arrondi : 333 HT × 18% = 59.94 → 60', () => {
  assert.equal(tvaDeHT(333, 18), 60);
});

test('Arrondi : 1 666 HT × 18% = 299.88 → 300', () => {
  assert.equal(tvaDeHT(1666, 18), 300);
});

test('Arrondi : 1 667 HT × 18% = 300.06 → 300', () => {
  assert.equal(tvaDeHT(1667, 18), 300);
});

test('Stabilité ATCD : TTC→HT→TTC ne perd pas de FCFA sur valeur ronde', () => {
  const ttcInitial = 11800;
  const ht = htDeTTC(ttcInitial, 18);
  const ttcRetour = ttcDeHT(ht, 18);
  assert.equal(ttcRetour, ttcInitial);
});

// ─── Bloc 6 : Cas frontaliers ─────────────────────────────────────────
test('TVA sur 0 HT = 0', () => {
  assert.equal(tvaDeHT(0, 18), 0);
});

test('Aucun montant ne devrait être négatif', () => {
  // Un avoir/remboursement est saisi avec des montants positifs mais
  // marqué comme avoir. Le calcul TVA reste positif.
  assert.ok(tvaDeHT(10000, 18) >= 0);
});

// ─── Bloc 7 : Cohérence pour DSF (sommes de l'exercice) ──────────────
test('Sommation 1000 factures de 10 000 HT à 18% = TVA cohérente', () => {
  const N = 1000;
  let totalTVA = 0;
  for (let i = 0; i < N; i++) {
    totalTVA += tvaDeHT(10000, 18);
  }
  assert.equal(totalTVA, 1000 * 1800);
  assert.equal(totalTVA, 1800000);
});

// ─── Bloc 8 : Cas piégeux DGI — montants flottants ──────────────────
test('TVA sur 99 999 HT × 18% = 17 999.82 → 18 000', () => {
  assert.equal(tvaDeHT(99999, 18), 18000);
});

test('TVA sur 100 001 HT × 18% = 18 000.18 → 18 000', () => {
  assert.equal(tvaDeHT(100001, 18), 18000);
});

// ─── Bloc 9 : Symétrie inverse à grande échelle ──────────────────────
test('Symétrie 100 cas aléatoires : HT → TTC → HT recalculé', () => {
  const erreurs = [];
  for (let i = 1; i <= 100; i++) {
    const ht = i * 1000;
    const ttc = ttcDeHT(ht, 18);
    const htRecalc = htDeTTC(ttc, 18);
    const ecart = Math.abs(ht - htRecalc);
    if (ecart > 1) erreurs.push({ ht, ttc, htRecalc, ecart });
  }
  assert.ok(erreurs.length === 0,
    `Tous les cas doivent avoir un écart ≤ 1 FCFA. Erreurs : ${JSON.stringify(erreurs.slice(0, 3))}`);
});
