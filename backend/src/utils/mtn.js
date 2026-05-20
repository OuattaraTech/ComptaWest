/**
 * Service MTN Mobile Money (Collections API) — Côte d'Ivoire, Ghana,
 * Cameroun, Bénin, Rwanda…
 *
 * API officielle : https://momodeveloper.mtn.com/docs/services/collection
 *
 * Spécificité MTN : contrairement à Wave/Orange qui envoient un LIEN au
 * client, MTN initie un PUSH USSD direct sur le téléphone du payeur. Il
 * faut donc connaître le numéro du payeur AVANT l'appel API (champ
 * `payerMobile` obligatoire). Côté UI on ouvre une mini-modale qui demande
 * le numéro avant de générer la requête.
 *
 * Workflow réel (mode sandbox/live) :
 *   1. POST /collection/token/   (Basic auth : apiUser:apiKey, en-tête
 *      Ocp-Apim-Subscription-Key) → access_token
 *   2. POST /collection/v1_0/requesttopay avec amount, currency=XOF,
 *      externalId, payer={partyIdType:"MSISDN", partyId:"<numero>"},
 *      payerMessage, payeeNote. En-tête X-Reference-Id (UUID v4).
 *      → 202 Accepted (paiement en attente côté téléphone payeur)
 *   3. Soit polling GET /requesttopay/{X-Reference-Id} pour le statut,
 *      soit webhook callback configuré sur le portail développeur.
 *
 * En mode 'mock' on simule le statut PENDING + un faux pay_url (page
 * d'instructions plutôt que vrai checkout, puisque MTN ne fournit pas
 * de page web standard).
 */

const crypto = require('crypto');

const MTN_TOKEN_URL_LIVE     = 'https://proxy.momoapi.mtn.com/collection/token/';
const MTN_TOKEN_URL_SANDBOX  = 'https://sandbox.momodeveloper.mtn.com/collection/token/';
const MTN_REQUEST_URL_LIVE   = 'https://proxy.momoapi.mtn.com/collection/v1_0/requesttopay';
const MTN_REQUEST_URL_SANDBOX= 'https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay';

/**
 * Initie un Request-to-Pay MTN MoMo. Le payeur reçoit une notification
 * USSD sur son téléphone pour valider/refuser.
 *
 * @param {object} opts
 * @param {string} opts.apiKey       Clé API MTN (api_user:api_key encodés Basic)
 * @param {string} opts.subscriptionKey Ocp-Apim-Subscription-Key
 * @param {string} opts.mode         'mock' | 'sandbox' | 'live'
 * @param {number} opts.amount       Montant entier (XOF)
 * @param {string} opts.currency     Devise (par défaut XOF)
 * @param {string} opts.clientReference Référence interne (numéro facture)
 * @param {string} opts.payerMobile  Numéro du payeur (E.164 sans le +)
 * @param {string} [opts.payerMessage] Message affiché au payeur (USSD)
 * @param {string} [opts.payeeNote]    Note interne (jamais affichée au payeur)
 *
 * @returns {Promise<{id, payment_url, status, mode, raw}>}
 */
async function creerCheckoutSession(opts) {
  const {
    apiKey,
    subscriptionKey,
    mode = apiKey ? 'sandbox' : 'mock',
    amount,
    currency = 'XOF',
    clientReference,
    payerMobile,
    payerMessage,
    payeeNote,
  } = opts;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Montant invalide pour MTN MoMo');
  }
  if (!payerMobile) {
    throw new Error('Numéro du payeur requis pour MTN MoMo');
  }
  const cleanMobile = String(payerMobile).replace(/[^\d]/g, '');

  // ─── Mode MOCK ──────────────────────────────────────────────────────────
  if (mode === 'mock') {
    const id = crypto.randomUUID();
    return {
      id,
      // Pas de vrai checkout web côté MTN : on renvoie une page d'instructions
      payment_url: `https://demo.mtn.ci/momo-pending/${id}`,
      status: 'PENDING',
      mode: 'mock',
      payer_mobile: cleanMobile,
      raw: { mocked: true, amount, currency, clientReference, payerMobile: cleanMobile },
    };
  }

  // ─── Mode SANDBOX / LIVE ────────────────────────────────────────────────
  const tokenUrl   = mode === 'live' ? MTN_TOKEN_URL_LIVE   : MTN_TOKEN_URL_SANDBOX;
  const requestUrl = mode === 'live' ? MTN_REQUEST_URL_LIVE : MTN_REQUEST_URL_SANDBOX;

  // Étape 1 : access_token via Basic auth
  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${apiKey}`,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
  });
  if (!tokenRes.ok) {
    throw new Error(`MTN OAuth failed: HTTP ${tokenRes.status}`);
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // Étape 2 : Request to pay (push USSD au payeur)
  const referenceId = crypto.randomUUID(); // X-Reference-Id, sert d'ID de session côté MTN
  const initRes = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Reference-Id': referenceId,
      'X-Target-Environment': mode === 'live' ? 'mtnci' : 'sandbox',
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(Math.round(amount)),
      currency,
      externalId: clientReference,
      payer: { partyIdType: 'MSISDN', partyId: cleanMobile },
      payerMessage: payerMessage || `Facture ${clientReference}`,
      payeeNote: payeeNote || `ApeX ${clientReference}`,
    }),
  });
  if (initRes.status !== 202) {
    const errText = await initRes.text().catch(() => '');
    throw new Error(`MTN request-to-pay failed: HTTP ${initRes.status} — ${errText.slice(0, 200)}`);
  }
  return {
    id: referenceId,
    payment_url: `tel:${cleanMobile}`,    // pas de page web : on indique juste au commercial le numéro
    status: 'PENDING',
    mode,
    payer_mobile: cleanMobile,
    raw: { reference_id: referenceId },
  };
}

/**
 * Vérifie la signature d'un callback MTN.
 *
 * MTN propose un mécanisme de "X-Callback-Url" + signature configurable.
 * Pour le MVP on supporte une signature HMAC-SHA256 partagée comme pour
 * wave.js (paramétrable côté portail MoMo).
 */
function verifierSignatureWebhook({ payloadBrut, signature, webhookSecret }) {
  if (!webhookSecret || !signature) return false;
  const calculee = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadBrut)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculee, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}

module.exports = {
  creerCheckoutSession,
  verifierSignatureWebhook,
};
