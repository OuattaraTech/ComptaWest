/**
 * E2E — Cycle de vie d'un abonnement (LOT 3.2).
 *
 * Couvre le parcours commercial le plus sensible :
 *   - Lecture du palier actif d'un nouveau compte
 *   - Upgrade vers Pro (cas conversion freemium → payant)
 *   - Downgrade vers Starter
 *   - Refus d'un palier inconnu
 *   - Quotas cohérents avec le palier courant
 *
 * Si l'upgrade/downgrade casse, la facturation décroche immédiatement.
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

let token, eid;

test('Bootstrap : compte démo + entreprise', async () => {
  const r = await call('POST', '/auth/demo');
  token = r.body.data.token;
  const e = await call('GET', '/entreprises', { token });
  eid = e.body.data[0].id;
  assert.ok(token && eid);
});

test('Lecture du palier actif', async () => {
  const r = await call('GET', '/abonnement', { token, eid });
  assert.equal(r.status, 200);
  assert.ok(r.body.data.abonnement?.palier, 'Un palier doit être exposé');
  assert.ok(r.body.data.quotas, 'Quotas exposés');
  assert.ok(r.body.data.usage, 'Usage exposé');
});

test('Upgrade vers Pro accepté', async () => {
  const r = await call('PUT', '/abonnement', {
    token, eid,
    body: { palier: 'pro', periodicite: 'mensuel' },
  });
  assert.equal(r.status, 200, `Upgrade refusé : ${JSON.stringify(r.body)}`);
  assert.equal(r.body.data.abonnement.palier, 'pro');
  // Sur Pro, le quota d'écritures/mois doit être supérieur ou illimité
  const q = r.body.data.quotas;
  assert.ok(q.libelle === 'Pro' || q.libelle?.toLowerCase().includes('pro'),
    `Libellé attendu Pro, reçu : ${q.libelle}`);
});

test('Downgrade vers Starter accepté', async () => {
  const r = await call('PUT', '/abonnement', {
    token, eid,
    body: { palier: 'starter', periodicite: 'mensuel' },
  });
  assert.equal(r.status, 200, `Downgrade refusé : ${JSON.stringify(r.body)}`);
  assert.equal(r.body.data.abonnement.palier, 'starter');
});

test('Palier inconnu refusé', async () => {
  const r = await call('PUT', '/abonnement', {
    token, eid,
    body: { palier: 'premium_illimite', periodicite: 'mensuel' },
  });
  assert.ok(r.status >= 400, 'Un palier inconnu doit être refusé');
});

test('Les quotas reflètent bien le palier actuel', async () => {
  const r = await call('GET', '/abonnement', { token, eid });
  assert.equal(r.body.data.abonnement.palier, 'starter');
  assert.ok(r.body.data.quotas.libelle?.toLowerCase().includes('starter'),
    `Libellé quota incohérent avec le palier : ${r.body.data.quotas.libelle}`);
});
