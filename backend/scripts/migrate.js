#!/usr/bin/env node
/**
 * Runner de migrations ComptaWest
 * ----------------------------------------------------------------------------
 * Applique les fichiers SQL de config/migrations/ dans l'ordre, en gardant
 * la trace de ce qui a déjà été appliqué dans la table schema_migrations.
 *
 * Usage :
 *   npm run migrate            applique toutes les migrations en attente
 *   npm run migrate:status     affiche l'état (appliquées / en attente)
 *   npm run migrate:baseline   marque toutes les migrations actuelles comme
 *                              appliquées SANS les exécuter (pour une base
 *                              existante déjà au schéma à jour)
 *
 * Chaque migration est exécutée dans sa propre transaction : en cas d'échec,
 * elle est intégralement annulée et le runner s'arrête.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'config', 'migrations');

const lireFichiers = () =>
  fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

const assurerTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
};

const dejaAppliquees = async () => {
  const r = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(r.rows.map(row => row.filename));
};

async function status() {
  await assurerTable();
  const appliquees = await dejaAppliquees();
  const fichiers = lireFichiers();
  console.log('\n  État des migrations :\n');
  for (const f of fichiers) {
    console.log(`   ${appliquees.has(f) ? '✓ appliquée ' : '· en attente'}  ${f}`);
  }
  const enAttente = fichiers.filter(f => !appliquees.has(f));
  console.log(`\n  ${fichiers.length} migration(s), ${enAttente.length} en attente.\n`);
}

async function migrate() {
  await assurerTable();
  const appliquees = await dejaAppliquees();
  const enAttente = lireFichiers().filter(f => !appliquees.has(f));

  if (enAttente.length === 0) {
    console.log('  ✓ Base à jour, aucune migration en attente.');
    return;
  }

  console.log(`  ${enAttente.length} migration(s) à appliquer...\n`);
  for (const f of enAttente) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log(`   ✓ ${f}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`   ✗ ${f} — ÉCHEC, migration annulée :`);
      console.error(`     ${err.message}`);
      client.release();
      process.exitCode = 1;
      return;
    }
    client.release();
  }
  console.log('\n  ✓ Toutes les migrations en attente ont été appliquées.');
}

async function baseline() {
  await assurerTable();
  const fichiers = lireFichiers();
  let n = 0;
  for (const f of fichiers) {
    const r = await pool.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
      [f]
    );
    if (r.rowCount > 0) n++;
  }
  console.log(`  ✓ Baseline : ${n} migration(s) marquée(s) comme appliquée(s) sans exécution (${fichiers.length} au total).`);
}

(async () => {
  const cmd = process.argv[2] || 'migrate';
  try {
    if (cmd === 'status')        await status();
    else if (cmd === 'baseline') await baseline();
    else                         await migrate();
  } catch (err) {
    console.error('  ✗ Erreur runner de migrations :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
