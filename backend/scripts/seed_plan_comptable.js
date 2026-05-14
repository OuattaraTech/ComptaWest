/**
 * Migration runtime : crée le plan SYSCOHADA, les journaux et l'exercice courant
 * pour toutes les entreprises existantes qui n'en ont pas encore.
 *
 * Usage : node scripts/seed_plan_comptable.js
 *
 * Idempotent : peut être relancé sans danger (ON CONFLICT DO NOTHING partout).
 */
require('dotenv').config();
const pool = require('../config/database');
const {
  creerPlanComptableSyscohada,
  creerJournauxDefaut,
  creerExerciceCourant,
} = require('../src/utils/helpers');

async function run() {
  const client = await pool.connect();
  try {
    const entreprises = await client.query('SELECT id, nom FROM entreprises WHERE actif = true ORDER BY created_at');
    console.log(`→ ${entreprises.rows.length} entreprise(s) à initialiser`);

    let ok = 0, skip = 0;
    for (const ent of entreprises.rows) {
      // Vérifier si le plan est déjà présent
      const existing = await client.query(
        'SELECT COUNT(*) FROM plan_comptable WHERE entreprise_id = $1 AND est_systeme = true',
        [ent.id]
      );
      if (parseInt(existing.rows[0].count) > 100) {
        console.log(`  ⊘ ${ent.nom} : plan déjà présent, ignoré`);
        skip++;
        continue;
      }

      await client.query('BEGIN');
      try {
        await creerPlanComptableSyscohada(ent.id, client);
        await creerJournauxDefaut(ent.id, client);
        await creerExerciceCourant(ent.id, client);
        await client.query('COMMIT');
        console.log(`  ✓ ${ent.nom}`);
        ok++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${ent.nom} :`, err.message);
      }
    }

    console.log(`\n✅ Terminé : ${ok} initialisée(s), ${skip} ignorée(s)`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
