/**
 * Tests d'audit-trail (LOT 1.5).
 *
 * Vérifie que chaque opération sensible laisse une trace immuable dans
 * audit_log avec : qui (utilisateur), quand (timestamp), quoi (entité +
 * action), valeurs.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost', port: 5432, database: 'comptawest',
  user: 'comptawest_user', password: 'LMFtEaQJFNSdEhheNVZnUrt',
});

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

let token, eid, userId;

test('SETUP : compte démo + récupération userId', async () => {
  const r = await call('POST', '/auth/demo');
  token = r.body.data.token;
  userId = r.body.data.user.id;
  const ent = await call('GET', '/entreprises', { token });
  eid = ent.body.data[0].id;
});

// ─── Test 1 : la création d'une dépense laisse une trace ──────────────
test('AUDIT : créer une dépense → entrée dans audit_log', async () => {
  const avant = await pool.query(
    `SELECT COUNT(*)::int AS n FROM audit_log WHERE utilisateur_id = $1`, [userId]
  );

  const r = await call('POST', '/depenses', {
    token, eid,
    body: { description: 'Test audit', montant_ht: 5000, montant_ttc: 5900, date_depense: '2026-06-15', statut: 'en_attente', mode_paiement: 'cash' },
  });
  assert.equal(r.status, 201, `Création dépense doit réussir : ${JSON.stringify(r.body)}`);

  const apres = await pool.query(
    `SELECT COUNT(*)::int AS n FROM audit_log WHERE utilisateur_id = $1`, [userId]
  );
  assert.ok(apres.rows[0].n > avant.rows[0].n,
    `audit_log doit gagner au moins 1 ligne (avant=${avant.rows[0].n}, après=${apres.rows[0].n})`);
});

// ─── Test 2 : structure de la trace ───────────────────────────────────
test('AUDIT : la trace contient qui/quand/quoi/entité', async () => {
  const r = await pool.query(
    `SELECT utilisateur_id, action, entite, entite_id, created_at, details
       FROM audit_log
      WHERE utilisateur_id = $1
      ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const trace = r.rows[0];
  assert.ok(trace, 'Aucune trace trouvée');
  assert.equal(trace.utilisateur_id, userId, 'Qui : utilisateur_id manquant ou erroné');
  assert.ok(trace.created_at instanceof Date, 'Quand : created_at manquant');
  assert.ok(trace.action, 'Quoi : action manquante');
  assert.ok(trace.entite, 'Entité : type manquant');
});

// ─── Test 3 : immutabilité — tentative d'UPDATE → exception ──────────
test('IMMUTABILITÉ : UPDATE sur audit_log → exception trigger', async () => {
  const trace = await pool.query(
    `SELECT id FROM audit_log WHERE utilisateur_id = $1 LIMIT 1`, [userId]
  );
  if (!trace.rows[0]) return; // pas de trace, skip
  let erreur = null;
  try {
    await pool.query(`UPDATE audit_log SET action = 'TENTATIVE_HACK' WHERE id = $1`, [trace.rows[0].id]);
  } catch (e) {
    erreur = e;
  }
  assert.ok(erreur, 'UPDATE doit lever une exception');
  assert.match(erreur.message, /audit_log est immuable/, 'Le message doit indiquer l\'immutabilité');
});

// ─── Test 4 : immutabilité — DELETE → exception ──────────────────────
test('IMMUTABILITÉ : DELETE sur audit_log → exception trigger', async () => {
  const trace = await pool.query(
    `SELECT id FROM audit_log WHERE utilisateur_id = $1 LIMIT 1`, [userId]
  );
  if (!trace.rows[0]) return;
  let erreur = null;
  try {
    await pool.query(`DELETE FROM audit_log WHERE id = $1`, [trace.rows[0].id]);
  } catch (e) {
    erreur = e;
  }
  assert.ok(erreur, 'DELETE doit lever une exception');
  assert.match(erreur.message, /audit_log est immuable/);
});

// ─── Test 5 : INSERT est autorisé (sinon l'app ne marcherait pas) ────
test('IMMUTABILITÉ : INSERT sur audit_log est autorisé', async () => {
  const r = await pool.query(
    `INSERT INTO audit_log (utilisateur_id, action, entite, details)
     VALUES ($1, 'TEST', 'test', $2) RETURNING id`,
    [userId, JSON.stringify({ test: true })]
  );
  assert.ok(r.rows[0]?.id, 'INSERT doit retourner un id');
});

test('CLEANUP : fermer le pool', async () => {
  await pool.end();
});
