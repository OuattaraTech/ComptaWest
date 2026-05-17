/**
 * Service Orange Money (Web Payment) — Côte d'Ivoire / UEMOA.
 *
 * API officielle : https://developer.orange.com/apis/om-webpay
 *
 * Workflow réel (mode sandbox/live) :
 *   1. POST /oauth/v3/token   (Basic auth : client_id:client_secret)
 *      → renvoie un access_token de courte durée.
 *   2. POST /omcoreapis/1.0.0/mp/init avec amount, currency=XOF,
 *      order_id, return_url, cancel_url, notif_url
 *      → renvoie { pay_token, payment_url, notif_token }.
 *   3. Le client clique payment_url, paie via app/USSD Orange Money.
 *   4. Orange POST sur notif_url avec { status: 'SUCCESS'|'FAILED',
 *      pay_token, txnid }. La signature de validation est notif_token.
 *
 * En mode 'mock' (par défaut sans clé) on génère un faux pay_token + URL,
 * comme pour wave.js.
 */

const crypto = require('crypto');

// Endpoints prod et sandbox (Orange ne distingue que par la clé)
const ORANGE_OAUTH_URL    = 'https://api.orange.com/oauth/v3/token';
const ORANGE_WEBPAY_URL   = 'https://api.orange.com/orange-money-webpay/dev/v1/webpayment';

/**
 * Crée un paiement Orange Money Web Payment.
 *
 * @param {object} opts
 * @param {string} opts.apiKey      Clé d'API Orange (Authorization Basic)
 * @param {string} opts.mode        'mock' | 'sandbox' | 'live'
 * @param {number} opts.amount      Montant entier (XOF)
 * @param {string} opts.currency    Devise (par défaut XOF)
 * @param {string} opts.clientReference Référence interne (numéro facture)
 * @param {string} opts.returnUrl   Page de retour succès
 * @param {string} opts.cancelUrl   Page de retour annulation
 * @param {string} opts.notifUrl    URL webhook (notification serveur)
 *
 * @returns {Promise<{id, payment_url, status, mode, raw}>}
 */
async function creerCheckoutSession(opts) {
  const {
    apiKey,
    mode = apiKey ? 'sandbox' : 'mock',
    amount,
    currency = 'XOF',
    clientReference,
    returnUrl,
    cancelUrl,
    notifUrl,
  } = opts;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Montant invalide pour Orange Money');
  }

  // ─── Mode MOCK ──────────────────────────────────────────────────────────
  if (mode === 'mock') {
    const id = `om_mock_${crypto.randomBytes(8).toString('hex')}`;
    const baseUrl = returnUrl?.replace(/\/[^/]*$/, '') || 'https://demo.orange.ci';
    return {
      id,
      payment_url: `${baseUrl}/orange-pay/${id}`,
      status: 'PENDING',
      mode: 'mock',
      raw: { mocked: true, amount, currency, clientReference },
    };
  }

  // ─── Mode SANDBOX / LIVE ────────────────────────────────────────────────
  // Étape 1 : OAuth pour obtenir un access_token
  const tokenRes = await fetch(ORANGE_OAUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: 'grant_type=client_credentials',
  });
  if (!tokenRes.ok) {
    throw new Error(`Orange OAuth failed: HTTP ${tokenRes.status}`);
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // Étape 2 : Init payment
  const initRes = await fetch(ORANGE_WEBPAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      merchant_key: apiKey,        // clé marchand (parfois distincte du token)
      currency,
      order_id: clientReference,
      amount: String(Math.round(amount)),
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notif_url: notifUrl,
      lang: 'fr',
      reference: clientReference,
    }),
  });
  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => '');
    throw new Error(`Orange init failed: HTTP ${initRes.status} — ${errText.slice(0, 200)}`);
  }
  const data = await initRes.json();
  return {
    id: data.pay_token,
    payment_url: data.payment_url,
    status: data.status || 'PENDING',
    mode,
    raw: data,
  };
}

/**
 * Vérifie la signature d'un webhook Orange Money.
 *
 * Orange n'utilise pas HMAC mais un `notif_token` retourné à la création
 * de la session : la requête de notification contient le même token dans
 * le payload. On compare les deux. Pour le mode mock, on accepte une
 * signature reposant sur un HMAC-SHA256 du payload + webhook_secret, pour
 * pouvoir tester localement.
 */
function verifierSignatureWebhook({ payloadBrut, signature, webhookSecret, notifToken }) {
  // En production : on vérifie que le notif_token dans le payload correspond
  // à celui que nous avons stocké à la création de la session.
  if (notifToken && payloadBrut) {
    try {
      const parsed = typeof payloadBrut === 'string' ? JSON.parse(payloadBrut) : payloadBrut;
      if (parsed.notif_token && parsed.notif_token === notifToken) return true;
    } catch { /* fall-through */ }
  }
  // Fallback HMAC (mode test local) : même logique que wave.js
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
