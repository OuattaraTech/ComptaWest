/**
 * Service Wave (Mobile Money Côte d'Ivoire / Sénégal).
 *
 * Crée des « checkout sessions » : on génère un lien que le client clique,
 * il paie depuis son app Wave, et Wave nous notifie par webhook (lot A.2).
 *
 * Documentation officielle : https://docs.wave.com/business/api-reference/checkout
 *
 * Trois modes :
 *   - 'mock'    (par défaut en l'absence de clé) : génère un faux lien
 *                pour développer/tester l'UI sans compte marchand réel.
 *   - 'sandbox' : appelle l'environnement de test de Wave (clé sandbox).
 *   - 'live'    : production. Les paiements sont réels.
 */

const crypto = require('crypto');

const WAVE_BASE_URL_LIVE    = 'https://api.wave.com/v1';
const WAVE_BASE_URL_SANDBOX = 'https://api.wave.com/v1';
// Wave n'a pas d'URL sandbox distincte : le mode est dérivé du préfixe de
// la clé API (wave_sn_prod_ vs wave_sn_test_).

/**
 * Crée une session de paiement Wave.
 *
 * @param {object} opts
 * @param {string} opts.apiKey         Clé API marchand Wave (peut être null en mode mock)
 * @param {string} opts.mode           'mock' | 'sandbox' | 'live'
 * @param {number} opts.amount         Montant (entier, sans décimales pour XOF)
 * @param {string} opts.currency       Devise ISO (par défaut 'XOF')
 * @param {string} opts.clientReference Référence interne ApeX (ex. numéro de facture)
 * @param {string} opts.successUrl     URL de retour en cas de succès (page « merci »)
 * @param {string} opts.errorUrl       URL de retour en cas d'erreur
 * @param {string} [opts.restrictPayerMobile] Optionnel : impose un numéro Wave précis
 *
 * @returns {Promise<{id, wave_launch_url, status, raw}>}
 */
async function creerCheckoutSession(opts) {
  const {
    apiKey,
    mode = apiKey ? 'sandbox' : 'mock',
    amount,
    currency = 'XOF',
    clientReference,
    successUrl,
    errorUrl,
    restrictPayerMobile,
  } = opts;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Montant invalide pour la session Wave');
  }

  // ─── Mode MOCK : pas d'appel réseau, génère un faux lien ────────────────
  if (mode === 'mock') {
    const id = `cs_mock_${crypto.randomBytes(8).toString('hex')}`;
    const launch = `${successUrl?.replace(/\/[^/]*$/, '') || 'https://demo.wave.com'}/checkout/${id}`;
    return {
      id,
      wave_launch_url: launch,
      status: 'created',
      mode: 'mock',
      raw: { mocked: true, amount, currency, clientReference },
    };
  }

  // ─── Mode SANDBOX / LIVE : appel HTTP réel ──────────────────────────────
  const baseUrl = mode === 'live' ? WAVE_BASE_URL_LIVE : WAVE_BASE_URL_SANDBOX;
  const body = {
    amount: String(Math.round(amount)),
    currency,
    success_url: successUrl,
    error_url: errorUrl,
    client_reference: clientReference,
    ...(restrictPayerMobile ? { restrict_payer_mobile: restrictPayerMobile } : {}),
  };

  const res = await fetch(`${baseUrl}/checkout/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Wave checkout failed: HTTP ${res.status} — ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    wave_launch_url: data.wave_launch_url,
    status: data.status,
    mode,
    raw: data,
  };
}

/**
 * Vérifie la signature HMAC d'un webhook Wave.
 * Wave signe le payload avec HMAC-SHA256 + le webhook_secret du marchand.
 * En-tête à comparer : `Wave-Signature`.
 *
 * Utilisé au lot A.2.
 */
function verifierSignatureWebhook({ payloadBrut, signature, webhookSecret }) {
  if (!webhookSecret || !signature) return false;
  const calculee = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadBrut)
    .digest('hex');
  // Comparaison en temps constant pour éviter les attaques timing
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
