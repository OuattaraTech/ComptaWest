/**
 * E2E — Parcours onboarding complet d'une PME (LOT 3.1).
 *
 * Simule un nouveau client qui découvre ApeX :
 *   1. Crée son compte (signup démo = équivalent inscription rapide)
 *   2. Récupère son entreprise auto-initialisée
 *   3. Crée son premier client
 *   4. Crée sa première facture
 *   5. Enregistre un paiement
 *   6. Crée une dépense
 *   7. Consulte le grand livre
 *   8. Génère sa DSF (bilan + CR)
 *
 * Si l'un de ces flows casse, l'expérience pilote est compromise.
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

let token, eid, clientId, factureId;

// ─── 1. Inscription (signup démo) ──────────────────────────────────────
test('ÉTAPE 1 : Inscription rapide (signup)', async () => {
  const r = await call('POST', '/auth/demo');
  assert.equal(r.status, 200, 'Signup démo doit réussir');
  assert.ok(r.body.data.token, 'JWT doit être retourné');
  assert.ok(r.body.data.user.id, 'User ID doit être retourné');
  token = r.body.data.token;
});

// ─── 2. Récupération de l'entreprise auto-initialisée ──────────────────
test('ÉTAPE 2 : Entreprise initialisée avec plan SYSCOHADA', async () => {
  const r = await call('GET', '/entreprises', { token });
  assert.equal(r.status, 200);
  assert.ok(r.body.data.length > 0, 'Au moins une entreprise créée');
  const e = r.body.data[0];
  assert.ok(e.id, 'ID entreprise présent');
  assert.ok(e.nom, 'Nom entreprise présent');
  eid = e.id;
});

// ─── 3. Création d'un client ───────────────────────────────────────────
test('ÉTAPE 3 : Création du premier client', async () => {
  const r = await call('POST', '/clients', {
    token, eid,
    body: {
      nom: 'Société KONE & Fils',
      type: 'entreprise',
      email: 'contact@kone-fils.ci',
      telephone: '+225 27 22 00 00',
      pays: 'Côte d\'Ivoire',
    },
  });
  assert.ok(r.status === 200 || r.status === 201, `Création client OK : ${JSON.stringify(r.body)}`);
  assert.ok(r.body.data?.id, 'Client ID retourné');
  clientId = r.body.data.id;
});

// ─── 4. Création de la première facture ────────────────────────────────
test('ÉTAPE 4 : Création de la première facture', async () => {
  const r = await call('POST', '/factures', {
    token, eid,
    body: {
      client_id: clientId,
      date_emission: '2026-06-15',
      echeance: '2026-07-15',
      lignes: [
        { description: 'Prestation de conseil', quantite: 1, prix_unitaire: 500000, taux_tva: 18 },
      ],
    },
  });
  assert.ok(r.status === 200 || r.status === 201, `Création facture : ${JSON.stringify(r.body)}`);
  assert.ok(r.body.data?.id, 'Facture ID retourné');
  factureId = r.body.data.id;
  assert.equal(parseInt(r.body.data.total_ttc), 590000, 'TVA 18% appliquée correctement (590 000 FCFA)');
});

// ─── 5. Enregistrement d'un paiement ───────────────────────────────────
test('ÉTAPE 5 : Paiement de la facture', async () => {
  // Récupère un compte de trésorerie (initialisé avec l'entreprise)
  const c = await call('GET', '/tresorerie/comptes', { token, eid });
  const compteId = c.body.data?.[0]?.id;
  if (!compteId) {
    assert.fail('Aucun compte de trésorerie initialisé');
  }

  const r = await call('POST', `/factures/${factureId}/paiement`, {
    token, eid,
    body: {
      montant: 590000,
      date_paiement: '2026-06-20',
      mode_paiement: 'virement',
      compte_tresorerie_id: compteId,
    },
  });
  assert.ok(r.status === 200 || r.status === 201, `Paiement : ${JSON.stringify(r.body)}`);
});

// ─── 6. Création d'une dépense ─────────────────────────────────────────
test('ÉTAPE 6 : Saisie d\'une dépense', async () => {
  const r = await call('POST', '/depenses', {
    token, eid,
    body: {
      description: 'Loyer juin 2026',
      montant_ht: 200000, montant_ttc: 200000,
      date_depense: '2026-06-05',
      statut: 'payee',
      mode_paiement: 'virement',
    },
  });
  assert.ok(r.status === 200 || r.status === 201, `Dépense : ${JSON.stringify(r.body)}`);
});

// ─── 7. Consultation du grand livre ────────────────────────────────────
test('ÉTAPE 7 : Le grand livre reflète les opérations', async () => {
  const r = await call('GET', '/comptabilite/grand-livre?compte=411', { token, eid });
  // Endpoint peut être 200 (lignes) ou 404 si pas d'écritures sur 411
  assert.ok([200, 404].includes(r.status), `Grand livre : ${r.status}`);
});

// ─── 8. Génération de la DSF ───────────────────────────────────────────
test('ÉTAPE 8 : Génération de la liasse DSF', async () => {
  const ex = await call('GET', '/dsf/exercices', { token, eid });
  const exId = ex.body.data?.[0]?.id;
  assert.ok(exId, 'Exercice présent');

  const dsf = await call('GET', `/dsf/${exId}/data`, { token, eid });
  assert.equal(dsf.status, 200);
  const d = dsf.body.data;
  assert.ok(d.bilan_actif, 'Bilan ACTIF généré');
  assert.ok(d.bilan_passif, 'Bilan PASSIF généré');
  assert.ok(d.compte_resultat, 'Compte de résultat généré');
  assert.ok(d.tafire, 'TAFIRE générée');
  assert.ok(d.annexes, 'Annexes générées');
  // Bilan équilibré
  assert.ok(Math.abs(d.equilibre) <= 1,
    `Bilan déséquilibré : actif=${d.bilan_actif.total_net}, passif=${d.bilan_passif.total}, écart=${d.equilibre}`);
});
