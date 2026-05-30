/**
 * Webhooks de confirmation des PSP de paiement d'abonnement ApeX.
 *
 * Routes (toutes publiques, vérification par signature obligatoire) :
 *   POST /api/webhooks/wave    → Wave Business
 *   POST /api/webhooks/orange  → Orange Money Web Payment
 *   POST /api/webhooks/stripe  → Stripe Checkout Session
 *
 * Sécurité :
 *   - Chaque endpoint vérifie la signature du PSP avant d'activer
 *     l'abonnement. Une signature invalide retourne 400 sans accuser
 *     réception (Stripe et Wave retentent automatiquement).
 *   - Le body brut (raw) est nécessaire pour la vérification HMAC.
 *     Les routes correspondantes utilisent express.raw().
 *
 * Idempotence : `activerAbonnement` est idempotent — un webhook livré
 * plusieurs fois ne crée pas de doublon.
 */
'use strict';

const pool = require('../../config/database');
const { activerAbonnement } = require('./checkoutController');
const {
  verifierSignatureWave,
  verifierSignatureOrange,
  verifierSignatureStripe,
} = require('../utils/checkout-psp');

// Trouve le paiement à partir de la référence externe renvoyée par le PSP.
async function trouverPaiementParReference(reference) {
  const r = await pool.query(
    `SELECT id FROM paiements_abonnement WHERE reference_externe = $1 LIMIT 1`,
    [reference]
  );
  return r.rows[0]?.id || null;
}

// ─── POST /api/webhooks/wave ───────────────────────────────────────────────
async function webhookWave(req, res) {
  try {
    const raw = req.rawBody?.toString('utf8') || JSON.stringify(req.body);
    const signature = req.headers['wave-signature'];
    if (!verifierSignatureWave(raw, signature)) {
      return res.status(400).json({ ok: false, error: 'signature_invalide' });
    }
    const event = req.body;
    if (event.type !== 'checkout.session.completed') {
      return res.json({ ok: true, ignored: event.type });
    }
    const session = event.data || {};
    const paiementId = session.client_reference || await trouverPaiementParReference(session.id);
    if (!paiementId) return res.status(404).json({ ok: false, error: 'paiement_introuvable' });

    const result = await activerAbonnement(paiementId, { source: 'webhook_wave' });
    if (!result.ok) return res.status(500).json({ ok: false, error: result.message });
    res.json({ ok: true });
  } catch (err) {
    console.error('[webhook][wave]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── POST /api/webhooks/orange ─────────────────────────────────────────────
async function webhookOrange(req, res) {
  try {
    const raw = req.rawBody?.toString('utf8') || JSON.stringify(req.body);
    const signature = req.headers['x-orange-signature'];
    if (!verifierSignatureOrange(raw, signature)) {
      return res.status(400).json({ ok: false, error: 'signature_invalide' });
    }
    const event = req.body;
    if (event.status !== 'SUCCESS') {
      // Marque en failed si le PSP nous dit FAILED ou EXPIRED
      if (event.status === 'FAILED' || event.status === 'EXPIRED') {
        const paiementId = await trouverPaiementParReference(event.pay_token || event.order_id);
        if (paiementId) {
          await pool.query(
            `UPDATE paiements_abonnement SET statut = $1, completed_at = NOW(), erreur = $2 WHERE id = $3`,
            [event.status.toLowerCase(), `Orange ${event.status}`, paiementId]
          );
        }
      }
      return res.json({ ok: true, ignored: event.status });
    }
    const paiementId = await trouverPaiementParReference(event.pay_token || event.order_id);
    if (!paiementId) return res.status(404).json({ ok: false, error: 'paiement_introuvable' });
    const result = await activerAbonnement(paiementId, { source: 'webhook_orange' });
    if (!result.ok) return res.status(500).json({ ok: false, error: result.message });
    res.json({ ok: true });
  } catch (err) {
    console.error('[webhook][orange]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── POST /api/webhooks/stripe ─────────────────────────────────────────────
async function webhookStripe(req, res) {
  try {
    const raw = req.rawBody?.toString('utf8') || JSON.stringify(req.body);
    const signature = req.headers['stripe-signature'];
    if (!verifierSignatureStripe(raw, signature)) {
      return res.status(400).json({ ok: false, error: 'signature_invalide' });
    }
    const event = req.body;
    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
      return res.json({ ok: true, ignored: event.type });
    }
    const session = event.data?.object || {};
    const paiementId = session.client_reference_id
      || session.metadata?.paiement_id
      || await trouverPaiementParReference(session.id);
    if (!paiementId) return res.status(404).json({ ok: false, error: 'paiement_introuvable' });

    const result = await activerAbonnement(paiementId, { source: 'webhook_stripe' });
    if (!result.ok) return res.status(500).json({ ok: false, error: result.message });
    res.json({ ok: true });
  } catch (err) {
    console.error('[webhook][stripe]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { webhookWave, webhookOrange, webhookStripe };
