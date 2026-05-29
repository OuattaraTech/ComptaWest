/**
 * Test de charge maison (sans k6/Gatling).
 *
 * Simule N utilisateurs simultanés effectuant des opérations typiques :
 *   - login démo (1 req)
 *   - lecture entreprises (1 req)
 *   - lecture factures (1 req)
 *   - création d'une dépense (1 req)
 *
 * Mesure : latence P50/P95/P99, requêtes/sec, taux d'erreur.
 *
 * Usage :
 *   NODE_ENV=test node scripts/load-test.js 50    # 50 utilisateurs simultanés
 */
const http = require('node:http');

const HOST = 'localhost';
const PORT = 5000;
const NB_USERS = parseInt(process.argv[2] || '20');

function call(method, path, { token, eid, body } = {}) {
  const start = Date.now();
  return new Promise((resolve) => {
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
        const duration = Date.now() - start;
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch (_) {}
        resolve({ status: res.statusCode, body: parsed, duration });
      });
    });
    req.on('error', (err) => resolve({ status: 0, error: err.message, duration: Date.now() - start }));
    if (data) req.write(data);
    req.end();
  });
}

async function utilisateurSimule(uid) {
  const stats = { ops: 0, errors: 0, latences: [] };

  // 1. Login démo
  const login = await call('POST', '/auth/demo');
  stats.ops++; stats.latences.push(login.duration);
  if (login.status !== 200) { stats.errors++; return stats; }
  const token = login.body.data.token;

  // 2. Liste entreprises
  const ent = await call('GET', '/entreprises', { token });
  stats.ops++; stats.latences.push(ent.duration);
  if (ent.status !== 200) { stats.errors++; return stats; }
  const eid = ent.body.data[0].id;

  // 3. Liste factures
  const fact = await call('GET', '/factures', { token, eid });
  stats.ops++; stats.latences.push(fact.duration);
  if (fact.status !== 200) stats.errors++;

  // 4. Création d'une dépense
  const dep = await call('POST', '/depenses', {
    token, eid,
    body: { description: `Charge test U${uid}`, montant_ht: 1000, montant_ttc: 1180, date_depense: '2026-06-15', statut: 'en_attente', mode_paiement: 'cash' },
  });
  stats.ops++; stats.latences.push(dep.duration);
  if (dep.status !== 201) stats.errors++;

  return stats;
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p / 100);
  return sorted[Math.min(idx, sorted.length - 1)];
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`  TEST DE CHARGE — ${NB_USERS} utilisateurs simultanés`);
  console.log(`═══════════════════════════════════════════════════════════════════\n`);

  const startGlobal = Date.now();
  const results = await Promise.all(
    Array.from({ length: NB_USERS }, (_, i) => utilisateurSimule(i))
  );
  const durationGlobal = (Date.now() - startGlobal) / 1000;

  const toutesLatences = results.flatMap(r => r.latences);
  const totalOps = results.reduce((s, r) => s + r.ops, 0);
  const totalErreurs = results.reduce((s, r) => s + r.errors, 0);

  console.log(`  Durée totale       : ${durationGlobal.toFixed(2)} s`);
  console.log(`  Opérations totales : ${totalOps}`);
  console.log(`  Erreurs            : ${totalErreurs} (${((totalErreurs / totalOps) * 100).toFixed(1)}%)`);
  console.log(`  Throughput         : ${(totalOps / durationGlobal).toFixed(1)} req/s`);
  console.log(`\n  Latences (ms) :`);
  console.log(`    P50  (médiane)   : ${percentile(toutesLatences, 50)}`);
  console.log(`    P95              : ${percentile(toutesLatences, 95)}`);
  console.log(`    P99              : ${percentile(toutesLatences, 99)}`);
  console.log(`    Max              : ${Math.max(...toutesLatences)}`);
  console.log(`    Min              : ${Math.min(...toutesLatences)}`);
  console.log(`\n═══════════════════════════════════════════════════════════════════\n`);
})();
