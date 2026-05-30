/**
 * Checkout d'abonnement ApeX.
 *
 * Trois moyens de paiement : Wave Business, Orange Money Web Payment, Stripe
 * (cartes bancaires). Un quatrième mode "mock" est utilisé en dev et pour
 * les démos commerciales (PAYMENT_MODE=mock dans .env).
 *
 * Endpoints exposés :
 *   POST /api/abonnement/checkout                → crée une session, retourne url_redirection
 *   GET  /api/abonnement/checkout/:id/status     → polling pour Wave/Orange (frontend)
 *   POST /api/abonnement/checkout/:id/mock-success → uniquement en mode mock, simule succès
 *
 * L'activation effective de l'abonnement (UPSERT abonnements) se fait dans
 * `activerAbonnement` côté webhook ou côté mock-success. Cette fonction
 * est aussi exposée pour les tests et la console admin.
 */
'use strict';

const pool = require('../../config/database');
const { logAudit } = require('../utils/audit');
const { envoyerEmail } = require('../utils/email');
const { confirmationPaiement } = require('../utils/emailTemplates');
const {
  PAYMENT_MODE, calculerMontant, creerSessionPaiement,
} = require('../utils/checkout-psp');

const PALIERS_PAYANTS = ['starter', 'pro'];
const PERIODICITES = ['mensuel', 'annuel'];
const MOYENS = ['wave', 'orange', 'stripe', 'mock'];

// ─── POST /api/abonnement/checkout ─────────────────────────────────────────
//   Body : { palier: 'starter'|'pro', periodicite: 'mensuel'|'annuel', moyen: 'wave'|'orange'|'stripe' }
//   Réponse : { paiement_id, url_redirection, montant_fcfa, moyen, mode_psp }
async function creerCheckout(req, res) {
  try {
    const { palier, periodicite, moyen } = req.body || {};

    if (!PALIERS_PAYANTS.includes(palier)) {
      return res.status(400).json({
        success: false,
        message: `Palier invalide. Acceptés : ${PALIERS_PAYANTS.join(', ')}`,
      });
    }
    if (!PERIODICITES.includes(periodicite)) {
      return res.status(400).json({ success: false, message: 'Périodicité invalide' });
    }
    if (!MOYENS.includes(moyen)) {
      return res.status(400).json({ success: false, message: 'Moyen de paiement invalide' });
    }

    const montant = calculerMontant(palier, periodicite);
    if (!montant || montant <= 0) {
      return res.status(400).json({ success: false, message: 'Montant calculé invalide' });
    }

    // Crée la ligne paiements_abonnement en pending
    const ins = await pool.query(`
      INSERT INTO paiements_abonnement
        (entreprise_id, utilisateur_id, palier, periodicite, montant_fcfa, moyen, statut)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING id, entreprise_id, palier, periodicite, montant_fcfa, moyen, created_at, expires_at
    `, [req.entrepriseId, req.user.id, palier, periodicite, montant, moyen]);
    const paiement = ins.rows[0];

    // Appelle le PSP pour obtenir l'URL de redirection
    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const retourUrl = `${baseUrl}/checkout/success?paiement=${paiement.id}`;
    const annulationUrl = `${baseUrl}/tarifs?annule=1`;

    const session = await creerSessionPaiement({
      paiement, moyen, baseUrl, retourUrl, annulationUrl,
    });

    // Met à jour la ligne avec les infos PSP
    await pool.query(`
      UPDATE paiements_abonnement
         SET reference_externe = $1, url_redirection = $2, metadata = $3
       WHERE id = $4
    `, [session.reference_externe, session.url_redirection, JSON.stringify(session.metadata), paiement.id]);

    logAudit(req, 'CHECKOUT_CREATED', 'abonnement', paiement.id, { palier, periodicite, moyen, montant });

    res.json({
      success: true,
      data: {
        paiement_id: paiement.id,
        url_redirection: session.url_redirection,
        montant_fcfa: montant,
        moyen,
        mode_psp: PAYMENT_MODE === 'mock' || (session.metadata && session.metadata.mode === 'mock') ? 'mock' : 'live',
        expires_at: paiement.expires_at,
      },
    });
  } catch (err) {
    console.error('[checkout] creerCheckout:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/abonnement/checkout/:id/status ───────────────────────────────
//   Polling utilisé par le frontend (Wave/Orange) pour savoir quand le
//   paiement est confirmé via webhook.
async function statutCheckout(req, res) {
  try {
    const r = await pool.query(`
      SELECT id, statut, palier, periodicite, montant_fcfa, moyen,
             completed_at, expires_at, erreur
        FROM paiements_abonnement
       WHERE id = $1 AND entreprise_id = $2
    `, [req.params.id, req.entrepriseId]);

    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Paiement introuvable' });
    }
    const p = r.rows[0];
    if (p.statut === 'pending' && new Date(p.expires_at) < new Date()) {
      // Expire silencieusement à la lecture
      await pool.query(`UPDATE paiements_abonnement SET statut = 'expired' WHERE id = $1`, [p.id]);
      p.statut = 'expired';
    }
    res.json({ success: true, data: p });
  } catch (err) {
    console.error('[checkout] statutCheckout:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── POST /api/abonnement/checkout/:id/mock-success ────────────────────────
//   Endpoint réservé au mode mock : appelé par la page front /checkout/mock/:id
//   après 3 secondes d'attente simulée, déclenche l'activation comme si le
//   PSP avait confirmé.
async function mockSuccess(req, res) {
  try {
    if (PAYMENT_MODE !== 'mock') {
      return res.status(403).json({
        success: false,
        message: 'Endpoint réservé au mode PAYMENT_MODE=mock',
      });
    }
    const result = await activerAbonnement(req.params.id, { source: 'mock' });
    if (!result.ok) return res.status(400).json({ success: false, message: result.message });
    logAudit(req, 'PAYMENT_MOCK_SUCCESS', 'abonnement', req.params.id, {});
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[checkout] mockSuccess:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── activerAbonnement (interne, utilisée par mock + webhooks) ─────────────
/**
 * Marque le paiement comme `success` et UPSERT la ligne `abonnements`
 * correspondante avec les nouvelles dates et le nouveau palier. Envoie
 * également l'email de confirmation au propriétaire de l'entreprise.
 *
 * Idempotent : si le paiement est déjà `success`, ne re-crée pas
 * l'abonnement (cas du webhook livré plusieurs fois par le PSP).
 */
async function activerAbonnement(paiementId, ctx = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE OF p : on verrouille uniquement la ligne paiements_abonnement.
    // PostgreSQL refuse FOR UPDATE global sur la nullable side d'un LEFT JOIN
    // (utilisateurs u peut être NULL si utilisateur_id était NULL).
    const pRes = await client.query(`
      SELECT p.*, e.nom AS entreprise_nom, u.email AS user_email, u.nom AS user_nom
        FROM paiements_abonnement p
        JOIN entreprises e ON e.id = p.entreprise_id
        LEFT JOIN utilisateurs u ON u.id = p.utilisateur_id
       WHERE p.id = $1
       FOR UPDATE OF p
    `, [paiementId]);

    if (pRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, message: 'Paiement introuvable' };
    }
    const paiement = pRes.rows[0];

    // Idempotence : si déjà success, on retourne OK sans rien refaire
    if (paiement.statut === 'success') {
      await client.query('ROLLBACK');
      return { ok: true, data: { paiement_id: paiement.id, statut: 'success', deja_traite: true } };
    }

    // Marque le paiement success
    await client.query(`
      UPDATE paiements_abonnement
         SET statut = 'success', completed_at = NOW(),
             metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
       WHERE id = $2
    `, [JSON.stringify({ activation_source: ctx.source || 'webhook', activated_at: new Date().toISOString() }), paiement.id]);

    // UPSERT abonnements
    const dateFinExpr = paiement.periodicite === 'annuel'
      ? `CURRENT_DATE + INTERVAL '365 days'`
      : `CURRENT_DATE + INTERVAL '30 days'`;

    await client.query(`
      INSERT INTO abonnements
        (entreprise_id, palier, statut, periodicite, date_debut, date_fin,
         prix_mensuel_fcfa, notes_commerciales)
      VALUES ($1, $2, 'actif', $3, CURRENT_DATE, ${dateFinExpr},
              $4, $5)
      ON CONFLICT (entreprise_id) DO UPDATE SET
        palier = EXCLUDED.palier,
        statut = 'actif',
        periodicite = EXCLUDED.periodicite,
        date_debut = EXCLUDED.date_debut,
        date_fin = EXCLUDED.date_fin,
        prix_mensuel_fcfa = EXCLUDED.prix_mensuel_fcfa,
        notes_commerciales = EXCLUDED.notes_commerciales,
        updated_at = NOW()
    `, [
      paiement.entreprise_id,
      paiement.palier,
      paiement.periodicite,
      paiement.periodicite === 'annuel'
        ? Math.round(paiement.montant_fcfa / 12)
        : paiement.montant_fcfa,
      `Activé via ${paiement.moyen} le ${new Date().toISOString().slice(0, 10)} (paiement ${paiement.id.slice(0, 8)})`,
    ]);

    await client.query('COMMIT');

    // Envoi email de confirmation (hors transaction)
    if (paiement.user_email) {
      try {
        const tpl = confirmationPaiement({
          nom_utilisateur: paiement.user_nom || '',
          palier: paiement.palier,
          periodicite: paiement.periodicite,
          montant_fcfa: paiement.montant_fcfa,
          moyen: paiement.moyen,
          entreprise_nom: paiement.entreprise_nom,
        });
        await envoyerEmail({ to: paiement.user_email, ...tpl, tags: { type: 'confirmation_paiement' } });
      } catch (e) { console.error('[checkout] email confirmation KO:', e.message); }
    }

    return {
      ok: true,
      data: {
        paiement_id: paiement.id,
        statut: 'success',
        palier: paiement.palier,
        periodicite: paiement.periodicite,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[checkout] activerAbonnement:', err.message);
    return { ok: false, message: err.message };
  } finally {
    client.release();
  }
}

module.exports = {
  creerCheckout,
  statutCheckout,
  mockSuccess,
  activerAbonnement,
};
