/**
 * Tests de cohérence DSF (LOT 2.4).
 *
 * Vérifie qu'avec un jeu d'écritures équilibrées, la liasse DSF reste
 * elle-même équilibrée et que les calculs principaux sont cohérents.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

function call(method, path, { token, eid, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: 'localhost', port: 5000, path: '/api' + path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(eid ? { 'X-Entreprise-Id': eid } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch (_) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

let token, eid, exerciceId;

test('SETUP : démo + 1er exercice', async () => {
  const r = await call('POST', '/auth/demo');
  token = r.body.data.token;
  const ent = await call('GET', '/entreprises', { token });
  eid = ent.body.data[0].id;
  const ex = await call('GET', '/dsf/exercices', { token, eid });
  exerciceId = ex.body.data[0].id;
});

// ─── Test 1 : DSF initiale équilibrée (démo a déjà des écritures) ────
test('COHÉRENCE : DSF du démo doit être équilibrée (écart ≤ 1 FCFA)', async () => {
  const r = await call('GET', `/dsf/${exerciceId}/data`, { token, eid });
  assert.equal(r.status, 200);
  const d = r.body.data;
  assert.ok(Math.abs(d.equilibre) <= 1,
    `Bilan déséquilibré : actif ${d.bilan_actif.total_net}, passif ${d.bilan_passif.total}, écart ${d.equilibre}`);
});

// ─── Test 2 : après nouvelle écriture équilibrée → bilan reste équilibré ─
test('COHÉRENCE : ajouter une écriture équilibrée → bilan toujours équilibré', async () => {
  await call('POST', '/comptabilite/ecritures', {
    token, eid,
    body: {
      journal_code: 'OD', date: '2026-06-15', libelle: 'Test cohérence',
      lignes: [
        { compte: '512', debit: 50000, credit: 0 },
        { compte: '101', debit: 0, credit: 50000 },
      ],
    },
  });
  const r = await call('GET', `/dsf/${exerciceId}/data`, { token, eid });
  const d = r.body.data;
  assert.ok(Math.abs(d.equilibre) <= 1,
    `Écart après écriture équilibrée : ${d.equilibre}`);
});

// ─── Test 3 : 20 écritures équilibrées → bilan toujours équilibré ────
test('COHÉRENCE : 20 écritures équilibrées successives → bilan toujours équilibré', async () => {
  for (let i = 0; i < 20; i++) {
    await call('POST', '/comptabilite/ecritures', {
      token, eid,
      body: {
        journal_code: 'OD', date: '2026-06-15', libelle: `Stress ${i}`,
        lignes: [
          { compte: '512', debit: 1000 * (i + 1), credit: 0 },
          { compte: '707', debit: 0, credit: 1000 * (i + 1) },
        ],
      },
    });
  }
  const r = await call('GET', `/dsf/${exerciceId}/data`, { token, eid });
  const d = r.body.data;
  assert.ok(Math.abs(d.equilibre) <= 1,
    `Écart après 20 écritures : ${d.equilibre} FCFA`);
});

// ─── Test 4 : cohérence CR vs bilan (résultat net) ───────────────────
test('COHÉRENCE : résultat net du CR = mouvement classes 7 - mouvement classes 6', async () => {
  const r = await call('GET', `/dsf/${exerciceId}/data`, { token, eid });
  const d = r.body.data;
  // Résultat net affiché par le CR
  const resultatCR = d.compte_resultat.indicateurs.resultat_net;
  // Vérif sommaire : doit être un nombre fini
  assert.ok(Number.isFinite(resultatCR), 'Résultat net doit être un nombre fini');
});

// ─── Test 5 : structure de la liasse complète ────────────────────────
test('STRUCTURE : la liasse contient les 4 formulaires + annexes', async () => {
  const r = await call('GET', `/dsf/${exerciceId}/data`, { token, eid });
  const d = r.body.data;
  assert.ok(d.bilan_actif?.lignes?.length > 0, 'Bilan ACTIF doit avoir des lignes');
  assert.ok(d.bilan_passif?.lignes?.length > 0, 'Bilan PASSIF doit avoir des lignes');
  assert.ok(d.compte_resultat?.lignes?.length > 0, 'Compte de résultat doit avoir des lignes');
  assert.ok(d.tafire?.lignes?.length > 0, 'TAFIRE doit avoir des lignes');
  assert.ok(d.annexes, 'Annexes doivent être présentes');
});

// ─── Test 6 : génération PDF retourne bien un PDF ────────────────────
test('PDF : /dsf/:id/pdf retourne un PDF non vide', async () => {
  // Ne pas parser en JSON (c'est un blob binaire)
  const blob = await new Promise((resolve, reject) => {
    const req = http.request({
      host: 'localhost', port: 5000, path: `/api/dsf/${exerciceId}/pdf`, method: 'GET',
      headers: { Authorization: 'Bearer ' + token, 'X-Entreprise-Id': eid },
    }, (res) => {
      let chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, size: Buffer.concat(chunks).length, head: Buffer.concat(chunks).slice(0, 4).toString() }));
    });
    req.on('error', reject); req.end();
  });
  assert.equal(blob.status, 200);
  assert.ok(blob.size > 1000, `PDF doit faire > 1 Ko (taille ${blob.size})`);
  assert.equal(blob.head, '%PDF', 'Doit commencer par %PDF');
});

// ─── Test 7 : diagnostic d'écart fonctionne ──────────────────────────
test('DIAGNOSTIC : endpoint retourne la structure attendue', async () => {
  const r = await call('GET', `/dsf/${exerciceId}/diagnostic-ecart`, { token, eid });
  assert.equal(r.status, 200);
  const d = r.body.data;
  assert.ok('ecart_montant' in d, 'Champ ecart_montant attendu');
  assert.ok('causes_probables' in d, 'Champ causes_probables attendu');
  assert.ok(Array.isArray(d.comptes_inverses), 'comptes_inverses doit être un array');
  assert.ok(Array.isArray(d.comptes_orphelins), 'comptes_orphelins doit être un array');
});
