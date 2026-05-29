/**
 * Tests d'isolation multi-tenant (LOT 1.3).
 *
 * Vérifie qu'aucun utilisateur ne peut accéder aux données d'une autre
 * entreprise, même en forgeant le header X-Entreprise-Id ou l'ID d'une
 * ressource.
 *
 * Approche : crée 2 entreprises (A et B), 2 utilisateurs (alice@A, bob@B).
 * Crée des données dans A. Tente de les lire/modifier depuis bob → tous
 * les endpoints doivent répondre 403/404 sans rien révéler.
 *
 * NB : ces tests nécessitent que le serveur backend tourne sur
 * http://localhost:5000 et qu'un compte démo soit générable
 * (POST /api/auth/demo).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const HOST = 'localhost';
const PORT = 5000;

function call(method, path, { token, eid, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: HOST, port: PORT, path: '/api' + path, method,
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
        resolve({ status: res.statusCode, body: parsed, raw: buf });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function nouveauDemo() {
  const r = await call('POST', '/auth/demo');
  if (!r.body?.success) throw new Error('Création démo échouée : ' + JSON.stringify(r.body));
  return r.body.data.token;
}

async function mesEntreprises(token) {
  const r = await call('GET', '/entreprises', { token });
  return (r.body?.data || []).filter(e => !e.via_cabinet);
}

// ─── Setup global : crée 2 environnements démos isolés ──────────────────
test('SETUP : Création de 2 dossiers démo isolés', async (t) => {
  const tokenA = await nouveauDemo();
  const tokenB = await nouveauDemo();
  const eA = (await mesEntreprises(tokenA))[0];
  const eB = (await mesEntreprises(tokenB))[0];
  t.diagnostic(`Entreprise A : ${eA.id} (alice)`);
  t.diagnostic(`Entreprise B : ${eB.id} (bob)`);
  assert.notEqual(eA.id, eB.id, 'Les 2 entreprises doivent être distinctes');

  // Stocke dans le context global pour les autres tests
  global.__iso = { tokenA, tokenB, eA, eB };
});

// ─── Test : alice voit ses propres factures ─────────────────────────────
test('ISOLATION : alice peut lire SES factures (200)', async () => {
  const { tokenA, eA } = global.__iso;
  const r = await call('GET', '/factures', { token: tokenA, eid: eA.id });
  assert.equal(r.status, 200, 'alice doit pouvoir lire ses factures');
});

// ─── Test critique : bob NE peut PAS lire les factures de A ────────────
test('ISOLATION : bob ne peut PAS lire les factures de A (403)', async () => {
  const { tokenB, eA } = global.__iso;
  const r = await call('GET', '/factures', { token: tokenB, eid: eA.id });
  assert.equal(r.status, 403, 'bob doit recevoir 403 sur les factures de A');
});

// ─── Modules métier sensibles : tentatives cross-tenant ─────────────────
const ENDPOINTS_SENSIBLES = [
  { method: 'GET', path: '/clients',              module: 'Clients' },
  { method: 'GET', path: '/factures',             module: 'Factures' },
  { method: 'GET', path: '/depenses',             module: 'Dépenses' },
  { method: 'GET', path: '/comptabilite/ecritures', module: 'Écritures' },
  { method: 'GET', path: '/comptabilite/balance', module: 'Balance' },
  { method: 'GET', path: '/dsf/exercices',        module: 'DSF' },
  { method: 'GET', path: '/tresorerie/comptes',   module: 'Trésorerie' },
  { method: 'GET', path: '/rapports/bilan',       module: 'Rapports' },
  { method: 'GET', path: '/audit-log',            module: 'Audit log' },
];

for (const ep of ENDPOINTS_SENSIBLES) {
  test(`ISOLATION : bob accède à ${ep.module} (${ep.path}) de A → refusé`, async () => {
    const { tokenB, eA } = global.__iso;
    const r = await call(ep.method, ep.path, { token: tokenB, eid: eA.id });
    assert.ok(r.status === 403 || r.status === 404,
      `${ep.module} : attendu 403 ou 404, reçu ${r.status} avec body ${JSON.stringify(r.body)}`);
    // Vérif anti-leak : la réponse ne doit pas contenir d'IDs ou données de A
    if (r.body?.data && Array.isArray(r.body.data) && r.body.data.length > 0) {
      throw new Error(`LEAK : ${ep.module} a renvoyé des données : ${JSON.stringify(r.body.data).slice(0, 200)}`);
    }
  });
}

// ─── Test : bob ne peut pas usurper l'entreprise A via X-Entreprise-Id ─
test('ISOLATION : bob change X-Entreprise-Id vers A → 403', async () => {
  const { tokenB, eA } = global.__iso;
  const r = await call('GET', '/auth/me/permissions', { token: tokenB, eid: eA.id });
  assert.equal(r.status, 403, 'Forging X-Entreprise-Id doit être bloqué');
});

// ─── Test : bob ne peut PAS créer une facture pour A ────────────────────
test('ISOLATION : bob tente de créer une facture dans A → 403', async () => {
  const { tokenB, eA } = global.__iso;
  const r = await call('POST', '/factures', {
    token: tokenB, eid: eA.id,
    body: { date_emission: '2026-01-01', echeance: '2026-02-01', lignes: [{ description: 'Test pirate', quantite: 1, prix_unitaire: 999 }] },
  });
  assert.equal(r.status, 403, 'bob ne doit PAS pouvoir créer dans A');
});

// ─── Test : sans token, tous les endpoints sont fermés ──────────────────
test('ISOLATION : sans token, /factures retourne 401', async () => {
  const r = await call('GET', '/factures', { eid: global.__iso.eA.id });
  assert.equal(r.status, 401);
});
