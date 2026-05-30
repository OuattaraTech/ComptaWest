/**
 * Abstraction des fournisseurs de paiement (PSP) pour les abonnements ApeX.
 *
 * Quatre moyens supportés :
 *   - wave    → Wave Business Checkout (API hosted)
 *   - orange  → Orange Money Web Payment (OMC2P)
 *   - stripe  → Stripe Checkout Session (cartes bancaires internationales)
 *   - mock    → simulation locale (aucun appel réseau, succès en 3 secondes)
 *
 * Comportement du mode mock :
 *   - utilisé automatiquement si PAYMENT_MODE=mock OU si la clé API du
 *     fournisseur cible est absente
 *   - retourne une URL vers /checkout/mock/:id qui simule l'attente puis
 *     déclenche le webhook interne après 3 secondes
 *
 * Chaque fonction expose la même signature :
 *   await creerSessionXxx({ paiement, baseUrl, retourUrl, annulationUrl })
 *     → { reference_externe, url_redirection, metadata }
 *
 * Aucune ne lance jamais d'exception fatale : en cas d'erreur réseau ou
 * de clé absente, on bascule sur le mock et on logge.
 */
'use strict';

const crypto = require('crypto');

const PAYMENT_MODE = process.env.PAYMENT_MODE || 'mock';

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Calcule le montant à débiter selon palier et périodicité, depuis les
 * QUOTAS du backend (source unique de vérité).
 */
function calculerMontant(palier, periodicite) {
  const { QUOTAS } = require('./quotas');
  const q = QUOTAS[palier];
  if (!q) throw new Error(`Palier inconnu : ${palier}`);
  return periodicite === 'annuel' ? q.prix_annuel : q.prix_mensuel;
}

/**
 * Génère une référence interne unique pour traçage (sert de fallback
 * si le PSP ne retourne pas d'id de session).
 */
function refInterne(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// ─── 1. WAVE BUSINESS CHECKOUT ─────────────────────────────────────────────
// Doc : https://developer.wave.com/api/checkout-sessions/
// Endpoint : POST https://api.wave.com/v1/checkout/sessions
//   Authorization: Bearer <WAVE_API_KEY>
//   Body : { amount, currency: "XOF", success_url, error_url, client_reference }

async function creerSessionWave({ paiement, retourUrl, annulationUrl }) {
  if (!process.env.WAVE_API_KEY) {
    return fallbackMock(paiement, 'wave', 'WAVE_API_KEY absente, bascule sur mock');
  }
  try {
    const body = {
      amount: String(paiement.montant_fcfa),
      currency: 'XOF',
      success_url: retourUrl,
      error_url: annulationUrl,
      client_reference: paiement.id,
    };
    const r = await fetch('https://api.wave.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WAVE_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': paiement.id,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Wave HTTP ${r.status} : ${await r.text()}`);
    const data = await r.json();
    return {
      reference_externe: data.id,
      url_redirection: data.wave_launch_url,
      metadata: { wave_session: data },
    };
  } catch (err) {
    console.error('[checkout][wave]', err.message);
    return fallbackMock(paiement, 'wave', err.message);
  }
}

// ─── 2. ORANGE MONEY WEB PAYMENT (OMC2P) ──────────────────────────────────
// Doc : https://developer.orange.com/apis/web-payment-cdi
// Flux : 1) auth OAuth → access_token  2) POST /webpayment → pay_token + payment_url

async function creerSessionOrange({ paiement, retourUrl, annulationUrl }) {
  const id = process.env.ORANGE_CLIENT_ID;
  const secret = process.env.ORANGE_CLIENT_SECRET;
  const merchantKey = process.env.ORANGE_MERCHANT_KEY;
  if (!id || !secret || !merchantKey) {
    return fallbackMock(paiement, 'orange', 'Clés Orange Money absentes, bascule sur mock');
  }
  try {
    // 1. Auth OAuth client_credentials
    const basic = Buffer.from(`${id}:${secret}`).toString('base64');
    const tokenRes = await fetch('https://api.orange.com/oauth/v3/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!tokenRes.ok) throw new Error(`Orange OAuth HTTP ${tokenRes.status}`);
    const { access_token } = await tokenRes.json();

    // 2. Création de la session web payment
    const orderId = refInterne('apex');
    const body = {
      merchant_key: merchantKey,
      currency: 'OUV',                  // OUV = code Orange pour XOF/FCFA en sandbox ; à vérifier en prod
      order_id: orderId,
      amount: paiement.montant_fcfa,
      return_url: retourUrl,
      cancel_url: annulationUrl,
      notif_url: `${process.env.BACKEND_BASE_URL || ''}/api/webhooks/orange`,
      lang: 'fr',
      reference: paiement.id,
    };
    const r = await fetch('https://api.orange.com/orange-money-webpay/cdi/v1/webpayment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Orange Webpay HTTP ${r.status} : ${await r.text()}`);
    const data = await r.json();
    return {
      reference_externe: data.pay_token || orderId,
      url_redirection: data.payment_url,
      metadata: { orange_session: data, order_id: orderId },
    };
  } catch (err) {
    console.error('[checkout][orange]', err.message);
    return fallbackMock(paiement, 'orange', err.message);
  }
}

// ─── 3. STRIPE CHECKOUT SESSION ────────────────────────────────────────────
// Doc : https://docs.stripe.com/api/checkout/sessions/create
// Stripe accepte les cartes bancaires internationales (Visa, Mastercard, Amex).
// On crée la session via fetch direct pour éviter d'ajouter le SDK officiel
// (qui pèse 5 Mo). En production, considérer require('stripe')(SECRET).

async function creerSessionStripe({ paiement, retourUrl, annulationUrl }) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return fallbackMock(paiement, 'stripe', 'STRIPE_SECRET_KEY absente, bascule sur mock');
  }
  try {
    // FCFA n'est pas accepté par Stripe pour le checkout (juin 2024).
    // On débite en EUR au taux de change fixe BCEAO : 1 EUR = 655,957 XOF.
    const eurAmount = Math.round((paiement.montant_fcfa / 655.957) * 100); // en cents
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', retourUrl + '?session_id={CHECKOUT_SESSION_ID}');
    params.append('cancel_url', annulationUrl);
    params.append('client_reference_id', paiement.id);
    params.append('line_items[0][price_data][currency]', 'eur');
    params.append('line_items[0][price_data][product_data][name]',
      `ApeX — Abonnement ${paiement.palier} ${paiement.periodicite}`);
    params.append('line_items[0][price_data][unit_amount]', String(eurAmount));
    params.append('line_items[0][quantity]', '1');
    params.append('metadata[paiement_id]', paiement.id);
    params.append('metadata[palier]', paiement.palier);
    params.append('metadata[periodicite]', paiement.periodicite);

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': paiement.id,
      },
      body: params.toString(),
    });
    if (!r.ok) throw new Error(`Stripe HTTP ${r.status} : ${await r.text()}`);
    const data = await r.json();
    return {
      reference_externe: data.id,
      url_redirection: data.url,
      metadata: { stripe_session: data, eur_amount_cents: eurAmount },
    };
  } catch (err) {
    console.error('[checkout][stripe]', err.message);
    return fallbackMock(paiement, 'stripe', err.message);
  }
}

// ─── 4. MOCK — simulation locale ───────────────────────────────────────────
// Crée une référence interne, renvoie vers /checkout/mock/:id du SPA.
// Cette page front simule l'attente puis appelle l'endpoint interne
// /api/abonnement/checkout/:id/mock-success qui déclenche l'activation.

function creerSessionMock({ paiement, baseUrl }) {
  const ref = refInterne('mock');
  return {
    reference_externe: ref,
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
 * Si PAYMENT_MODE === 'mock', force le mock quel que soit le `moyen` demandé.
 */
async function creerSessionPaiement({ paiement, moyen, baseUrl, retourUrl, annulationUrl }) {
  if (PAYMENT_MODE === 'mock' || moyen === 'mock') {
    return creerSessionMock({ paiement, baseUrl });
  }
  switch (moyen) {
    case 'wave':   return creerSessionWave({ paiement, retourUrl, annulationUrl });
    case 'orange': return creerSessionOrange({ paiement, retourUrl, annulationUrl });
    case 'stripe': return creerSessionStripe({ paiement, retourUrl, annulationUrl });
    default:       throw new Error(`Moyen de paiement inconnu : ${moyen}`);
  }
}

// ─── Vérification de signature de webhook ─────────────────────────────────

/** Wave : header `Wave-Signature` = HMAC-SHA256 du body avec WAVE_WEBHOOK_SECRET. */
function verifierSignatureWave(rawBody, signature) {
  if (!process.env.WAVE_WEBHOOK_SECRET) return PAYMENT_MODE === 'mock';
  const expected = crypto.createHmac('sha256', process.env.WAVE_WEBHOOK_SECRET)
    .update(rawBody).digest('hex');
  return safeCompare(signature, expected);
}

/** Orange : header `X-Orange-Signature` (à valider selon doc OMC2P). */
function verifierSignatureOrange(rawBody, signature) {
  if (!process.env.ORANGE_WEBHOOK_SECRET) return PAYMENT_MODE === 'mock';
  const expected = crypto.createHmac('sha256', process.env.ORANGE_WEBHOOK_SECRET)
    .update(rawBody).digest('hex');
  return safeCompare(signature, expected);
}

/** Stripe : header `Stripe-Signature` (format t=...,v1=...,v0=...). */
function verifierSignatureStripe(rawBody, signature) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return PAYMENT_MODE === 'mock';
  try {
    const elements = signature.split(',').reduce((acc, e) => {
      const [k, v] = e.split('=');
      acc[k] = v;
      return acc;
    }, {});
    const payload = `${elements.t}.${rawBody}`;
    const expected = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
      .update(payload).digest('hex');
    return safeCompare(elements.v1, expected);
  } catch (_) {
    return false;
  }
}

function safeCompare(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

module.exports = {
  PAYMENT_MODE,
  calculerMontant,
  creerSessionPaiement,
  verifierSignatureWave,
  verifierSignatureOrange,
  verifierSignatureStripe,
};
