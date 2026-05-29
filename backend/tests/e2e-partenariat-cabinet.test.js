/**
 * E2E — Cycle partenariat Cabinet ↔ PME (LOT 3.3).
 *
 * Couvre le tunnel d'activation commerciale :
 *   1. Cabinet active son statut Partenaire (génère un code parrain)
 *   2. Cabinet invite une PME par email (token + remise 15 % par défaut)
 *   3. La PME visualise l'invitation publique sans authentification
 *   4. La PME accepte → création de l'entreprise + lien cabinet_connections
 *   5. Le cabinet voit la PME dans `mes-clients`
 *   6. Une seconde acceptation avec le même token est rejetée
 *
 * Si cette chaîne casse, la croissance via cabinets est gelée.
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

let cabinetToken, cabinetEid, invitationToken;
const emailPme = `pme.test.${Date.now()}@apex-test.ci`;

// ─── 1. Le cabinet s'inscrit et active son statut Partenaire ──────────
test('ÉTAPE 1 : Cabinet active son statut Partenaire', async () => {
  const demo = await call('POST', '/auth/demo');
  cabinetToken = demo.body.data.token;
  const e = await call('GET', '/entreprises', { token: cabinetToken });
  cabinetEid = e.body.data[0].id;

  const act = await call('POST', '/cabinets/activer-partenariat', {
    token: cabinetToken, eid: cabinetEid,
  });
  assert.ok(act.status === 200 || act.status === 400,
    `Activation : ${JSON.stringify(act.body)}`);
  // status 400 = déjà partenaire (compte démo précédent), c'est OK aussi
  if (act.status === 200) {
    assert.ok(act.body.data.code_parrain, 'Code parrain généré');
    assert.equal(act.body.data.type_compte, 'cabinet_partenaire');
  }
});

// ─── 2. Le cabinet invite une PME ─────────────────────────────────────
test('ÉTAPE 2 : Invitation PME par email', async () => {
  const inv = await call('POST', '/cabinets/inviter-pme', {
    token: cabinetToken, eid: cabinetEid,
    body: { email_pme: emailPme, nom_pme: 'Société TEST E2E' },
  });
  assert.equal(inv.status, 200, `Invitation : ${JSON.stringify(inv.body)}`);
  assert.ok(inv.body.data.token, 'Token invitation présent');
  assert.equal(inv.body.data.remise_proposee_pct, 15,
    'Remise figée à 15 % côté serveur');
  invitationToken = inv.body.data.token;
});

// ─── 3. Vue publique de l'invitation (pas d'auth) ─────────────────────
test('ÉTAPE 3 : Lecture publique de l\'invitation', async () => {
  const r = await call('GET', `/invitations/cabinet/${invitationToken}`);
  assert.equal(r.status, 200, `Lecture invitation : ${JSON.stringify(r.body)}`);
  assert.equal(r.body.data.email_pme, emailPme);
  assert.equal(r.body.data.statut, 'pending');
});

// ─── 4. La PME accepte → création du dossier + lien cabinet ────────────
test('ÉTAPE 4 : Acceptation par la PME', async () => {
  const r = await call('POST', `/invitations/cabinet/${invitationToken}/accepter`, {
    body: {
      nom_dirigeant: 'M. KONE Yacouba',
      mot_de_passe: 'TestApeX2026!',
      nom_entreprise: 'KONE & Fils SARL',
      ncc: 'CI-ABJ-2026-12345',
    },
  });
  assert.equal(r.status, 200, `Acceptation : ${JSON.stringify(r.body)}`);
  assert.ok(r.body.data.token, 'JWT renvoyé pour login auto');
  assert.ok(r.body.data.entreprise?.id, 'Entreprise créée');
  assert.equal(r.body.data.remise_appliquee_pct, 15);
});

// ─── 5. Le cabinet voit la PME dans ses clients ───────────────────────
test('ÉTAPE 5 : La PME apparaît dans /cabinets/mes-clients', async () => {
  const r = await call('GET', '/cabinets/mes-clients', {
    token: cabinetToken, eid: cabinetEid,
  });
  assert.equal(r.status, 200);
  const found = (r.body.data || []).find(c => c.pme_nom === 'KONE & Fils SARL');
  assert.ok(found, 'Nouvelle PME présente dans mes-clients');
  assert.equal(found.statut_connection, 'active');
});

// ─── 6. Double acceptation refusée ────────────────────────────────────
test('ÉTAPE 6 : Token déjà utilisé → 410 Gone', async () => {
  const r = await call('POST', `/invitations/cabinet/${invitationToken}/accepter`, {
    body: {
      nom_dirigeant: 'Attaquant',
      mot_de_passe: 'AutreMdp123!',
      nom_entreprise: 'Tentative duplicat',
    },
  });
  assert.ok(r.status === 410 || r.status === 400,
    `Le token utilisé doit être refusé (statut reçu : ${r.status})`);
});
