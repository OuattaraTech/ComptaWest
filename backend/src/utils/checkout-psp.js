/**
 * Intégration CinetPay pour le checkout d'abonnement ApeX.
 *
 * CinetPay est un agrégateur de paiement ivoirien qui expose Wave,
 * Orange Money, MTN MoMo, Moov et les cartes bancaires Visa/Mastercard
 * via une seule API. Avantages par rapport à des intégrations directes :
 *   - 1 seul contrat commercial et 1 seul jeu de clés à gérer
 *   - Payouts FCFA directs sur le compte bancaire CI d'ApeX
 *   - Dashboard en français, support local
 *   - Pas de conversion EUR ↔ FCFA (économise les frais de change)
 *
 * Mode `mock` : si PAYMENT_MODE=mock OU si les clés CinetPay sont absentes,
 * on bascule sur une simulation locale (page front /checkout/mock/:id qui
 * attend 3,5 s puis active l'abonnement) — utile en dev et pour les démos.
 *
 * Doc CinetPay : https://docs.cinetpay.com/api/1.0-fr/
 */
'use strict';

const crypto = require('crypto');

const PAYMENT_MODE = process.env.PAYMENT_MODE || 'mock';

const CINETPAY_BASE = 'https://api-checkout.cinetpay.com/v2';

// ─── Helpers ───────────────────────────────────────────────────────────────

function calculerMontant(palier, periodicite) {
  const { QUOTAS } = require('./quotas');
  const q = QUOTAS[palier];
  if (!q) throw new Error(`Palier inconnu : ${palier}`);
  return periodicite === 'annuel' ? q.prix_annuel : q.prix_mensuel;
}

function refInterne(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Mapping du moyen choisi par l'utilisateur (Wave / Orange / Carte) vers
 * le `channels` CinetPay (CinetPay ne propose pas de granularité fine
 * par opérateur Mobile Money — l'utilisateur choisit son opérateur sur
 * la page CinetPay une fois redirigé).
 *   wave, orange, mtn, mock → MOBILE_MONEY (Wave + Orange + MTN + Moov visibles)
 *   stripe                  → CREDIT_CARD (Visa + Mastercard)
 *   cinetpay (générique)    → ALL (tous les moyens visibles)
 */
function moyenToChannels(moyen) {
  switch (moyen) {
    case 'wave':
    case 'orange':
    case 'mtn':
      return 'MOBILE_MONEY';
    case 'stripe':
      return 'CREDIT_CARD';
    case 'cinetpay':
    default:
      return 'ALL';
  }
}

// ─── 1. SESSION CINETPAY ───────────────────────────────────────────────────
// POST https://api-checkout.cinetpay.com/v2/payment
//   { apikey, site_id, transaction_id, amount, currency, description,
//     notify_url, return_url, channels, lang, metadata }
//   → { code: "201", data: { payment_url, payment_token } }

async function creerSessionCinetPay({ paiement, moyen, retourUrl }) {
  const apikey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  if (!apikey || !siteId) {
    return fallbackMock(paiement, 'cinetpay', 'CINETPAY_API_KEY ou CINETPAY_SITE_ID absente, bascule sur mock');
  }
  try {
    const transactionId = `apex_${paiement.id.slice(0, 8)}_${Date.now()}`;
    const notifyUrl = `${(process.env.BACKEND_BASE_URL || '').replace(/\/+$/, '')}/api/webhooks/abonnement/cinetpay`;

    const body = {
      apikey,
      site_id: siteId,
      transaction_id: transactionId,
      amount: paiement.montant_fcfa,
      currency: 'XOF',
      description: `ApeX — Abonnement ${paiement.palier} ${paiement.periodicite}`,
      notify_url: notifyUrl,
      return_url: retourUrl,
      channels: moyenToChannels(moyen),
      lang: 'FR',
      metadata: JSON.stringify({
        paiement_id: paiement.id,
        entreprise_id: paiement.entreprise_id,
        palier: paiement.palier,
        periodicite: paiement.periodicite,
        moyen_choisi: moyen,
      }),
    };

    const r = await fetch(`${CINETPAY_BASE}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok || data.code !== '201') {
      throw new Error(`CinetPay HTTP ${r.status} code=${data.code} : ${data.message || 'erreur inconnue'} ${JSON.stringify(data.description || {})}`);
    }
    return {
      reference_externe: transactionId,
      url_redirection: data.data.payment_url,
      metadata: {
        cinetpay_session: data.data,
        moyen_choisi: moyen,
        channels: body.channels,
        transaction_id: transactionId,
      },
    };
  } catch (err) {
    console.error('[checkout][cinetpay]', err.message);
    return fallbackMock(paiement, 'cinetpay', err.message);
  }
}

// ─── 2. VÉRIFICATION DU STATUT (anti-spoofing webhook) ────────────────────
// POST https://api-checkout.cinetpay.com/v2/payment/check
//   { apikey, site_id, transaction_id }
//   → { code: "00", data: { status: "ACCEPTED" | "REFUSED" | ..., amount, ... } }

async function verifierStatutCinetPay(transactionId) {
  const apikey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  if (!apikey || !siteId) {
    return { ok: false, status: 'no_credentials', raw: null };
  }
  try {
    const r = await fetch(`${CINETPAY_BASE}/payment/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey, site_id: siteId, transaction_id: transactionId }),
    });
    const data = await r.json();
    if (data.code !== '00') {
      return { ok: false, status: data.message || data.code, raw: data };
    }
    return { ok: true, status: data.data?.status || 'UNKNOWN', amount: data.data?.amount, raw: data };
  } catch (err) {
    console.error('[checkout][cinetpay][check]', err.message);
    return { ok: false, status: 'error', error: err.message, raw: null };
  }
}

// ─── 3. MOCK — simulation locale ───────────────────────────────────────────

function creerSessionMock({ paiement, baseUrl }) {
  return {
    reference_externe: refInterne('mock'),
    url_redirection: `${baseUrl}/checkout/mock/${paiement.id}`,
    metadata: { mode: 'mock', message: 'Paiement simulé en environnement de test' },
  };
}

function fallbackMock(paiement, moyen_initial, raison) {
  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return {
    reference_externe: refInterne('mock'),
    url_redirection: `${baseUrl}/checkout/mock/${paiement.id}`,
    metadata: { mode: 'mock', fallback_from: moyen_initial, raison },
  };
}

// ─── Façade ────────────────────────────────────────────────────────────────

/**
 * Crée une session de paiement et retourne :
 *   { reference_externe, url_redirection, metadata }
 *
 * Si PAYMENT_MODE === 'mock', force le mock quel que soit le `moyen`.
 * Sinon route TOUT vers CinetPay (avec le `channels` adapté au moyen choisi).
 */
async function creerSessionPaiement({ paiement, moyen, baseUrl, retourUrl }) {
  if (PAYMENT_MODE === 'mock' || moyen === 'mock') {
    return creerSessionMock({ paiement, baseUrl });
  }
  return creerSessionCinetPay({ paiement, moyen, retourUrl });
}

// ─── Vérification de signature de webhook CinetPay ────────────────────────
// CinetPay envoie un header `x-token` = HMAC-SHA256 d'une concaténation des
// champs du body (cpm_site_id, cpm_trans_id, cpm_trans_date, cpm_amount,
// cpm_currency, signature, payment_method, cel_phone_num, cpm_phone_prefixe,
// cpm_language, cpm_version, cpm_payment_config, cpm_page_action, cpm_custom,
// cpm_designation, cpm_error_message) signée avec CINETPAY_SECRET_KEY.

function verifierSignatureCinetPay(body, headerToken) {
  const secret = process.env.CINETPAY_SECRET_KEY;
  if (!secret) return PAYMENT_MODE === 'mock';
  if (!headerToken) return false;
  try {
    const fields = [
      'cpm_site_id', 'cpm_trans_id', 'cpm_trans_date', 'cpm_amount',
      'cpm_currency', 'signature', 'payment_method', 'cel_phone_num',
      'cpm_phone_prefixe', 'cpm_language', 'cpm_version',
      'cpm_payment_config', 'cpm_page_action', 'cpm_custom',
      'cpm_designation', 'cpm_error_message',
    ];
    const concat = fields.map(f => body?.[f] || '').join('');
    const expected = crypto.createHmac('sha256', secret).update(concat).digest('hex');
    return safeCompare(headerToken, expected);
  } catch (_) {
    return false;
  }
}

function safeCompare(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
  catch (_) { return false; }
}

module.exports = {
  PAYMENT_MODE,
  calculerMontant,
  creerSessionPaiement,
  verifierStatutCinetPay,
  verifierSignatureCinetPay,
};
