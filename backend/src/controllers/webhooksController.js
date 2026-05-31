/**
 * Webhook unique CinetPay pour la confirmation des paiements d'abonnement.
 *
 * Route : POST /api/webhooks/abonnement/cinetpay   (publique, signée)
 *
 * Sécurité en 2 couches :
 *   1. Vérification HMAC du header `x-token` avec CINETPAY_SECRET_KEY.
 *   2. Re-vérification auprès de CinetPay via POST /v2/payment/check
 *      (anti-spoofing supplémentaire : on ne fait confiance qu'à ce que
 *      l'API CinetPay confirme directement comme `status=ACCEPTED`).
 *
 * Idempotence : `activerAbonnement` est idempotent — un webhook livré
 * plusieurs fois ne crée pas de doublon.
 */
'use strict';

const pool = require('../../config/database');
const { activerAbonnement } = require('./checkoutController');
const {
  verifierSignatureCinetPay,
  verifierStatutCinetPay,
} = require('../utils/checkout-psp');

async function trouverPaiementParReference(reference) {
  const r = await pool.query(
    `SELECT id FROM paiements_abonnement WHERE reference_externe = $1 LIMIT 1`,
    [reference]
  );
  return r.rows[0]?.id || null;
}

// ─── POST /api/webhooks/abonnement/cinetpay ────────────────────────────────
async function webhookCinetPay(req, res) {
  try {
    const signature = req.headers['x-token'];
    const body = req.body || {};

    // Étape 1 : vérification de la signature HMAC du payload
    if (!verifierSignatureCinetPay(body, signature)) {
      console.warn('[webhook][cinetpay] signature invalide');
      return res.status(400).json({ ok: false, error: 'signature_invalide' });
    }

    // Étape 2 : récupère la transaction_id pour aller revérifier le statut
    const transactionId = body.cpm_trans_id;
    if (!transactionId) {
      return res.status(400).json({ ok: false, error: 'cpm_trans_id manquant' });
    }

    // Étape 3 : appelle l'API CinetPay pour vérifier le statut réel
    const verif = await verifierStatutCinetPay(transactionId);
    if (!verif.ok || verif.status !== 'ACCEPTED') {
      // On marque le paiement failed/refused mais on retourne 200 pour que
      // CinetPay ne re-tente pas indéfiniment.
      const paiementId = await trouverPaiementParReference(transactionId);
      if (paiementId) {
        await pool.query(
          `UPDATE paiements_abonnement
              SET statut = $1, completed_at = NOW(), erreur = $2,
                  metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
            WHERE id = $4 AND statut = 'pending'`,
          [
            verif.status === 'REFUSED' ? 'failed' : 'failed',
            `CinetPay status=${verif.status}`,
            JSON.stringify({ webhook_check: verif }),
            paiementId,
          ]
        );
      }
      return res.json({ ok: true, ignored: verif.status });
    }

    // Étape 4 : statut ACCEPTED confirmé → active l'abonnement
    const paiementId = await trouverPaiementParReference(transactionId);
    if (!paiementId) {
      console.warn(`[webhook][cinetpay] paiement introuvable pour transaction_id=${transactionId}`);
      return res.status(404).json({ ok: false, error: 'paiement_introuvable' });
    }

    const result = await activerAbonnement(paiementId, { source: 'webhook_cinetpay' });
    if (!result.ok) {
      return res.status(500).json({ ok: false, error: result.message });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[webhook][cinetpay]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { webhookCinetPay };
