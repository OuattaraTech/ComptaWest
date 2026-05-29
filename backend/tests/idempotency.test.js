/**
 * Tests d'idempotency-keys (LOT 1.4).
 *
 * Vérifie que les routes financières critiques rejettent les doubles
 * soumissions lorsqu'un header Idempotency-Key est fourni.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');

function call(method, path, { token, eid, body, idempotencyKey } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: 'localhost', port: 5000, path: '/api' + path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(eid ? { 'X-Entreprise-Id': eid } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
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

let token, eid;

test('SETUP : compte démo', async () => {
  const r = await call('POST', '/auth/demo');
  token = r.body.data.token;
  const ent = await call('GET', '/entreprises', { token });
  eid = ent.body.data[0].id;
});

// ─── Test 1 : sans idempotency-key, 3 dépenses identiques → 3 créations ─
test('SANS Idempotency-Key : 3 POST identiques → 3 créations distinctes', async () => {
  const body = { categorie: null, description: 'Test sans clé', montant_ht: 1000, montant_ttc: 1180, date_depense: '2026-06-15', statut: 'en_attente', mode_paiement: 'cash' };
  const r1 = await call('POST', '/depenses', { token, eid, body });
  const r2 = await call('POST', '/depenses', { token, eid, body });
  const r3 = await call('POST', '/depenses', { token, eid, body });
  assert.equal(r1.status, 201, 'r1 doit créer (status ' + r1.status + ' body=' + JSON.stringify(r1.body) + ')');
  assert.equal(r2.status, 201);
  assert.equal(r3.status, 201);
  assert.notEqual(r1.body.data.id, r2.body.data.id, 'IDs doivent différer sans clé');
  assert.notEqual(r2.body.data.id, r3.body.data.id);
});

// ─── Test 2 : avec Idempotency-Key, 3 POST → 1 seule création ─────────
test('AVEC Idempotency-Key : 3 POST identiques → 1 seule création', async () => {
  const key = 'test-idemp-' + crypto.randomUUID();
  const body = { categorie: null, description: 'Test avec clé', montant_ht: 2000, montant_ttc: 2360, date_depense: '2026-06-15', statut: 'en_attente', mode_paiement: 'cash' };
  const r1 = await call('POST', '/depenses', { token, eid, body, idempotencyKey: key });
  const r2 = await call('POST', '/depenses', { token, eid, body, idempotencyKey: key });
  const r3 = await call('POST', '/depenses', { token, eid, body, idempotencyKey: key });
  assert.equal(r1.status, 201);
  assert.equal(r2.status, 201, 'r2 doit retourner réponse cachée (201)');
  assert.equal(r3.status, 201);
  assert.equal(r1.body.data.id, r2.body.data.id, 'r2 doit renvoyer le même ID que r1 (cache)');
  assert.equal(r1.body.data.id, r3.body.data.id);
});

// ─── Test 3 : clé déjà utilisée avec payload différent → 409 ──────────
test('Idempotency-Key réutilisée avec payload différent → 409', async () => {
  const key = 'test-conflit-' + crypto.randomUUID();
  await call('POST', '/depenses', {
    token, eid, idempotencyKey: key,
    body: { categorie: null, description: 'Original', montant_ht: 100, montant_ttc: 118, date_depense: '2026-06-15', statut: 'en_attente', mode_paiement: 'cash' },
  });
  const r2 = await call('POST', '/depenses', {
    token, eid, idempotencyKey: key,
    body: { categorie: null, description: 'Différent', montant_ht: 999, montant_ttc: 1178, date_depense: '2026-06-15', statut: 'en_attente', mode_paiement: 'cash' },
  });
  assert.equal(r2.status, 409, 'Réutiliser une clé avec un body différent doit être refusé (409)');
});

// ─── Test 4 : double-clic réel — 10 POST concurrents → 1 seule ──────
test('Double-clic : 10 POST concurrents avec même clé → 1 seule création', async () => {
  const key = 'test-concurrent-' + crypto.randomUUID();
  const body = { categorie: null, description: 'Concurrent', montant_ht: 500, montant_ttc: 590, date_depense: '2026-06-15', statut: 'en_attente', mode_paiement: 'cash' };
  const promises = Array.from({ length: 10 }, () =>
    call('POST', '/depenses', { token, eid, body, idempotencyKey: key }));
  const results = await Promise.all(promises);
  const succès = results.filter(r => r.status === 201);
  const ids = new Set(succès.map(r => r.body?.data?.id).filter(Boolean));
  assert.ok(ids.size === 1, `Une seule dépense doit être créée, trouvé ${ids.size} IDs distincts`);
});

// ─── Test 5 : format de clé invalide → 400 ────────────────────────────
test('Idempotency-Key invalide (caractères interdits) → 400', async () => {
  const r = await call('POST', '/depenses', {
    token, eid,
    idempotencyKey: 'invalid key with spaces!@#',
    body: { categorie: null, description: 'X', montant_ht: 1, montant_ttc: 1, date_depense: '2026-06-15', statut: 'en_attente', mode_paiement: 'cash' },
  });
  assert.equal(r.status, 400);
});

// ─── Cleanup ───────────────────────────────────────────────────────────
test('CLEANUP : suppression des données de test', async () => {
  // Pas de cleanup HTTP — les données seront nettoyées par le cron démo
  // (les démos sont éphémères, demo_expires_at).
});
