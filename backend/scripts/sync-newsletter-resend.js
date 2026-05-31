#!/usr/bin/env node
/**
 * Backfill : pousse tous les abonnés newsletter déjà en base vers l'audience
 * Resend (utile une seule fois, après avoir branché la synchro, pour les
 * inscrits antérieurs). Les inscriptions/désinscriptions suivantes sont
 * synchronisées automatiquement par le contrôleur.
 *
 * Usage (sur le serveur, avec RESEND_API_KEY + RESEND_AUDIENCE_ID dans .env) :
 *   node scripts/sync-newsletter-resend.js
 *
 * Idempotent : ré-exécutable sans créer de doublons (Resend dédoublonne par
 * email, et on remet le bon statut unsubscribed).
 */
require('dotenv').config();
const pool = require('../config/database');
const { ajouterContact, desabonnerContact } = require('../src/utils/resendAudience');

(async () => {
  if ((!process.env.RESEND_AUDIENCE_API_KEY && !process.env.RESEND_API_KEY) || !process.env.RESEND_AUDIENCE_ID) {
    console.error('❌ RESEND_AUDIENCE_API_KEY (ou RESEND_API_KEY) et RESEND_AUDIENCE_ID doivent être définis dans .env.');
    process.exit(1);
  }

  try {
    const r = await pool.query('SELECT email, statut FROM newsletter_abonnes ORDER BY cree_le');
    const total = r.rows.length;
    console.log(`  ${total} abonné(s) à synchroniser vers l'audience Resend…\n`);

    let actifs = 0, desabos = 0;
    for (const row of r.rows) {
      if (row.statut === 'actif') {
        await ajouterContact({ email: row.email });
        actifs++;
      } else {
        await ajouterContact({ email: row.email });   // crée le contact…
        await desabonnerContact(row.email);            // …puis le marque désabonné
        desabos++;
      }
      // Petit délai pour rester sous les limites de débit Resend.
      await new Promise((res) => setTimeout(res, 120));
    }

    console.log(`\n  ✓ Terminé : ${actifs} actif(s) + ${desabos} désabonné(s) synchronisés.`);
  } catch (err) {
    console.error('❌', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
