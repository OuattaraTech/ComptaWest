/**
 * Tests d'équilibre comptable SYSCOHADA (LOT 2.3).
 *
 * Vérifie qu'aucune écriture déséquilibrée (D≠C) ne peut être créée.
 * Génère 100 cas aléatoires + cas frontaliers + cas piégeux.
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

test('SETUP : compte démo', async () => {
  const r = await call('POST', '/auth/demo');
  token = r.body.data.token;
  const ent = await call('GET', '/entreprises', { token });
  eid = ent.body.data[0].id;
});

// ─── Test 1 : écriture équilibrée (cas nominal) ──────────────────────
test('ÉQUILIBRE : écriture D=C créée avec succès', async () => {
  const r = await call('POST', '/comptabilite/ecritures', {
    token, eid,
    body: {
      journal_code: 'OD', date: '2026-06-15', libelle: 'Test équilibre OK',
      lignes: [
        { compte: '512', debit: 10000, credit: 0 },
        { compte: '707', debit: 0, credit: 10000 },
      ],
    },
  });
  assert.equal(r.status, 201, `Écriture équilibrée doit être créée : ${JSON.stringify(r.body)}`);
});

// ─── Test 2 : écriture déséquilibrée → refusée ───────────────────────
test('REJET : écriture D≠C (10 000 / 9 999) → 400 DESEQUILIBRE', async () => {
  const r = await call('POST', '/comptabilite/ecritures', {
    token, eid,
    body: {
      journal_code: 'OD', date: '2026-06-15', libelle: 'Test déséquilibre',
      lignes: [
        { compte: '512', debit: 10000, credit: 0 },
        { compte: '707', debit: 0, credit: 9999 },
      ],
    },
  });
  assert.equal(r.status, 400, 'Écriture déséquilibrée doit être refusée');
  assert.match(r.body.message || '', /déséquilibr|debit|credit|D.*C/i,
    'Message d\'erreur doit mentionner le déséquilibre');
});

// ─── Test 3 : écriture mono-ligne → refusée (D=C impossible) ─────────
test('REJET : écriture avec 1 seule ligne → 400 LIGNES_INSUFFISANTES', async () => {
  const r = await call('POST', '/comptabilite/ecritures', {
    token, eid,
    body: {
      journal_code: 'OD', date: '2026-06-15', libelle: 'Test 1 ligne',
      lignes: [{ compte: '512', debit: 1000, credit: 0 }],
    },
  });
  assert.equal(r.status, 400);
});

// ─── Test 4 : ligne avec D ET C non nuls → refusée ───────────────────
test('REJET : ligne avec debit ET credit non nuls → 400 LIGNE_INVALIDE', async () => {
  const r = await call('POST', '/comptabilite/ecritures', {
    token, eid,
    body: {
      journal_code: 'OD', date: '2026-06-15', libelle: 'Test mixte',
      lignes: [
        { compte: '512', debit: 500, credit: 500 },
        { compte: '707', debit: 0, credit: 500 },
      ],
    },
  });
  assert.equal(r.status, 400);
});

// ─── Test 5 : 100 écritures aléatoires équilibrées → toutes acceptées ─
test('ÉQUILIBRE : 100 écritures aléatoires équilibrées → 100 OK', async () => {
  const rng = (max) => Math.floor(Math.random() * max);
  let succes = 0;
  for (let i = 0; i < 100; i++) {
    const montant = rng(1000000) + 1000;
    const nbLignesD = 1 + rng(2);
    const nbLignesC = 1 + rng(2);
    // Répartit le montant aléatoirement entre les lignes débit
    const partsD = [];
    let restant = montant;
    for (let j = 0; j < nbLignesD - 1; j++) {
      const p = rng(restant - (nbLignesD - j - 1)) + 1;
      partsD.push(p); restant -= p;
    }
    partsD.push(restant);
    // Idem pour crédit (total == montant)
    const partsC = [];
    restant = montant;
    for (let j = 0; j < nbLignesC - 1; j++) {
      const p = rng(restant - (nbLignesC - j - 1)) + 1;
      partsC.push(p); restant -= p;
    }
    partsC.push(restant);

    const lignes = [
      ...partsD.map((p, k) => ({ compte: '512', debit: p, credit: 0 })),
      ...partsC.map((p, k) => ({ compte: '707', debit: 0, credit: p })),
    ];

    const r = await call('POST', '/comptabilite/ecritures', {
      token, eid,
      body: { journal_code: 'OD', date: '2026-06-15', libelle: `Aléa ${i}`, lignes },
    });
    if (r.status === 201) succes++;
    else if (i < 3) console.log('Échec écriture', i, ':', JSON.stringify(r.body));
  }
  assert.equal(succes, 100, `Toutes les 100 écritures équilibrées doivent passer (réussites : ${succes})`);
});

// ─── Test 6 : 20 écritures aléatoires DÉSÉQUILIBRÉES → toutes rejetées ─
test('REJET : 20 écritures déséquilibrées (D-C de 1 FCFA) → 20 refusées', async () => {
  let rejets = 0;
  for (let i = 0; i < 20; i++) {
    const montant = (i + 1) * 10000;
    const r = await call('POST', '/comptabilite/ecritures', {
      token, eid,
      body: {
        journal_code: 'OD', date: '2026-06-15', libelle: `Désé ${i}`,
        lignes: [
          { compte: '512', debit: montant, credit: 0 },
          { compte: '707', debit: 0, credit: montant - 1 }, // D > C de 1 FCFA
        ],
      },
    });
    if (r.status === 400) rejets++;
  }
  assert.equal(rejets, 20, 'Toutes les écritures à 1 FCFA d\'écart doivent être refusées');
});

// ─── Test 7 : écriture 0 / 0 → refusée ──────────────────────────────
test('REJET : écriture à montants nuls → 400', async () => {
  const r = await call('POST', '/comptabilite/ecritures', {
    token, eid,
    body: {
      journal_code: 'OD', date: '2026-06-15', libelle: 'Test nul',
      lignes: [
        { compte: '512', debit: 0, credit: 0 },
        { compte: '707', debit: 0, credit: 0 },
      ],
    },
  });
  assert.equal(r.status, 400);
});

// ─── Test 8 : journal inconnu → refusé ───────────────────────────────
test('REJET : journal_code inexistant → 400 JOURNAL_INCONNU', async () => {
  const r = await call('POST', '/comptabilite/ecritures', {
    token, eid,
    body: {
      journal_code: 'ZZ_INEXISTANT', date: '2026-06-15', libelle: 'Test journal',
      lignes: [
        { compte: '512', debit: 1000, credit: 0 },
        { compte: '707', debit: 0, credit: 1000 },
      ],
    },
  });
  assert.equal(r.status, 400);
  assert.match(r.body.message || '', /journal/i);
});
