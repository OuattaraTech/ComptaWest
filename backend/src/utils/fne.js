/**
 * Service FNE (Facture Normalisée Électronique) — DGI Côte d'Ivoire.
 *
 * Trois modes :
 *   - mock     : pas d'appel externe. Génère un numéro FNE plausible
 *                préfixé `MOCK-` et un hash SHA-256 local. Permet de
 *                démontrer la signature et le QR code sans dépendre du
 *                raccordement DGI.
 *   - sandbox  : appelle l'environnement de test de la DGI
 *                (http://54.247.95.108/ws). Le numéro est réel mais sans
 *                valeur fiscale. Utilisé pendant la phase d'intégration.
 *   - prod     : appelle l'environnement de production de la DGI. L'URL
 *                exacte est transmise par mail par la DGI après validation
 *                des spécimens — on la lit dans la variable d'env
 *                FNE_PROD_URL (entreprise par entreprise via leur config).
 *                Numéro fiscal opposable, sticker décompté.
 *
 * Spec implémentée d'après le document officiel DGI :
 *   « Procédure d'interfaçage des entreprises par API — mai 2025 »
 *   (à la racine du repo : FNE-procedureapi.pdf).
 *
 * Endpoints :
 *   POST $url/external/invoices/sign         — vente + bordereau achat
 *   POST $url/external/invoices/{id}/refund  — avoir (note de crédit)
 *
 * Auth :
 *   Authorization: Bearer <fne_api_key>
 */

const crypto = require('crypto');

// URL publique sur laquelle pointent les QR codes — c'est en fait le
// champ `token` renvoyé par la DGI qui contient l'URL exacte (sandbox vs
// prod). On garde une URL fallback pour le mode mock seulement.
const URL_VERIFICATION_MOCK = 'https://verif.dgi.gouv.ci/fne';

// Base URLs DGI. La prod est transmise par mail après validation, on la
// lit dans la config entreprise (champ futur fne_prod_url) ou via env.
const DGI_BASE_URLS = {
  sandbox: 'http://54.247.95.108/ws',
  prod:    process.env.FNE_PROD_URL || null,
};

const TIMEOUT_DGI_MS = 8000;   // certification = 8 s max (la DGI a un SLA ~ 2 s)

// ─── Mock helpers ────────────────────────────────────────────────────────
function calculerHash(facture, ncc) {
  const payload = [
    facture.numero,
    facture.date_facture,
    ncc || 'SANS_NCC',
    Math.round(facture.total_ht  || 0),
    Math.round(facture.total_tva || 0),
    Math.round(facture.total_ttc || 0),
    facture.devise || 'XOF',
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function genererNumeroFneMock() {
  const annee = new Date().getFullYear();
  const sequence = String(Math.floor(Math.random() * 9_999_999_999)).padStart(10, '0');
  return `MOCK-${annee}${sequence}`;
}

function construireQrDataMock(numeroFne, hash) {
  const params = new URLSearchParams({ fne: numeroFne, h: hash });
  return `${URL_VERIFICATION_MOCK}?${params.toString()}`;
}

// ─── Mapping payload ApeX → format DGI ───────────────────────────────────
// Conformément à l'annexe « Lexique » du document DGI.
const PAYMENT_METHOD_MAP = {
  espece:        'cash',         espèces: 'cash',     cash: 'cash',
  cb:            'card',         carte:   'card',     card: 'card',
  cheque:        'check',        chèque:  'check',    check: 'check',
  virement:      'transfer',     transfer: 'transfer',
  wave:          'mobile-money', orange_money: 'mobile-money', mtn_momo: 'mobile-money',
  mobile_money:  'mobile-money', 'mobile-money': 'mobile-money',
  a_terme:       'deferred',     deferred: 'deferred',
};

// Mapping taux TVA → code DGI (annexe « taxes »)
function codeTvaDgi(tauxTva) {
  const t = parseFloat(tauxTva);
  if (t === 18 || t === 18.0) return 'TVA';   // normal 18%
  if (t === 9)                return 'TVAB';  // réduit 9%
  if (t === 0)                return 'TVAC';  // exonération conventionnelle 0%
  return 'TVA';                                // défaut
}

// Détermine le template selon le profil client.
//   B2B si client professionnel (NCC connu et pays = Côte d'Ivoire)
//   B2F si client à l'international (pays ≠ CI)
//   B2G si client = institution gouvernementale (champ optionnel `is_gov`)
//   B2C par défaut (particulier)
function templateClient(client) {
  if (!client) return 'B2C';
  if (client.is_gov)                                          return 'B2G';
  if (client.pays && !/c[oô]te.?d.?ivoire|ci/i.test(client.pays)) return 'B2F';
  if (client.ninea || client.ncc)                             return 'B2B';
  return 'B2C';
}

/**
 * Construit le payload JSON exact attendu par l'API DGI.
 * Si `lignes` ou `client` manquent, on lève une erreur car la DGI les
 * exige (au moins 1 item, et template B2B oblige clientNcc).
 */
function construirePayloadDgi({ facture, lignes, client, entreprise }) {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw new Error('FNE : aucune ligne de facture. Au moins 1 item requis.');
  }

  const template = templateClient(client);
  const payment = PAYMENT_METHOD_MAP[String(facture.mode_paiement || '').toLowerCase()] || 'cash';

  const items = lignes.map(l => ({
    taxes:        [codeTvaDgi(l.taux_tva)],
    reference:    l.reference || l.code || undefined,
    description:  l.description || l.designation || l.libelle || '',
    quantity:     Number(l.quantite || 1),
    amount:       Number(l.prix_unitaire || 0),
    ...(l.remise_percent ? { discount: Number(l.remise_percent) } : {}),
    ...(l.unite          ? { measurementUnit: l.unite }            : {}),
  }));

  // pointOfSale et establishment sont obligatoires. À défaut on prend
  // le nom de l'entreprise (la DGI vérifie juste qu'ils sont non vides).
  const nomEntreprise = entreprise.nom || 'Etablissement principal';

  const payload = {
    invoiceType:   'sale',
    paymentMethod: payment,
    template,
    isRne:         false,    // pas de reçu RNE lié pour l'instant
    clientCompanyName: client?.nom || 'Client',
    clientPhone:       client?.telephone ? String(client.telephone) : '',
    clientEmail:       client?.email     || '',
    pointOfSale:   nomEntreprise.slice(0, 80),
    establishment: nomEntreprise.slice(0, 120),
    items,
  };

  // clientNcc obligatoire si template B2B
  if (template === 'B2B') {
    payload.clientNcc = client?.ninea || client?.ncc || '';
  }

  // Devise étrangère (template B2F)
  if (template === 'B2F' && facture.devise && facture.devise !== 'XOF') {
    payload.foreignCurrency = facture.devise;
    payload.foreignCurrencyRate = Number(facture.taux_change || 0);
  }

  // Champs optionnels — vendor, point de vente, message commercial
  if (entreprise.nom_commercial) payload.establishment = entreprise.nom_commercial.slice(0, 120);

  return payload;
}

// ─── Appel HTTP réel à la DGI ────────────────────────────────────────────
async function appelerDgi({ url, apiKey, payload }) {
  const controleur = new AbortController();
  const timeout = setTimeout(() => controleur.abort(), TIMEOUT_DGI_MS);

  let reponse;
  try {
    reponse = await fetch(url, {
      method: 'POST',
      signal: controleur.signal,
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const motif = err.name === 'AbortError'
      ? `timeout ${TIMEOUT_DGI_MS / 1000}s`
      : err.message;
    throw new FneNetworkError(`DGI injoignable (${motif})`);
  } finally {
    clearTimeout(timeout);
  }

  // Réponse : 200 = succès, 400 = bad_request, 401 = unauthorized, 500 = erreur DGI
  let body;
  try { body = await reponse.json(); }
  catch { body = { message: 'Réponse DGI non JSON' }; }

  if (!reponse.ok) {
    if (reponse.status === 401) {
      throw new FneAuthError(body.message || 'Clé API DGI invalide ou expirée');
    }
    if (reponse.status === 400) {
      // Erreur métier — pas de retry utile (le payload est mal formé)
      const err = new Error(body.message || 'Requête DGI rejetée');
      err.code = 'DGI_BAD_REQUEST';
      err.details = body;
      throw err;
    }
    // 5xx → réseau, retry possible via la queue
    throw new FneNetworkError(`DGI HTTP ${reponse.status} : ${body.message || 'Erreur serveur DGI'}`);
  }

  return body;   // { ncc, reference, token, warning, balance_sticker, invoice }
}

// ─── Erreurs typées ──────────────────────────────────────────────────────
class FneNetworkError extends Error {
  constructor(message) { super(message); this.name = 'FneNetworkError'; }
}
class FneAuthError extends Error {
  constructor(message) { super(message); this.name = 'FneAuthError'; }
}

// ─── Point d'entrée principal ────────────────────────────────────────────
/**
 * Certifie une facture auprès de la DGI (ou simule en mode mock).
 *
 * @param {object} args
 * @param {object} args.facture     — ligne table factures
 * @param {array}  [args.lignes]    — lignes_facture (requis pour sandbox/prod)
 * @param {object} [args.client]    — ligne table clients (requis pour sandbox/prod)
 * @param {object} args.entreprise  — { id, nom, ncc, fne_mode, fne_api_key, ... }
 */
async function certifierFacture({ facture, lignes, client, entreprise }) {
  const mode = entreprise.fne_mode || 'mock';
  const ncc = entreprise.ncc || null;

  // Fallback mock : mode 'mock', ou config incomplète (clé API absente).
  if (mode === 'mock' || !entreprise.fne_api_key) {
    const numeroFne = genererNumeroFneMock();
    const hash = calculerHash(facture, ncc);
    return {
      numero_fne: numeroFne,
      hash_facture: hash,
      qr_data: construireQrDataMock(numeroFne, hash),
      mode: 'mock',
      balance_sticker: null,
      dgi_response_raw: { simulated: true, generated_at: new Date().toISOString() },
    };
  }

  // Mode sandbox ou prod : appel réel
  const baseUrl = DGI_BASE_URLS[mode];
  if (!baseUrl) {
    throw new FneNetworkError(
      `Mode FNE '${mode}' : URL DGI non configurée. Pour la prod, définir FNE_PROD_URL après réception de l'URL par mail.`
    );
  }

  const payload = construirePayloadDgi({ facture, lignes, client, entreprise });
  const url = `${baseUrl}/external/invoices/sign`;
  const reponse = await appelerDgi({ url, apiKey: entreprise.fne_api_key, payload });

  // Mapping réponse DGI → format ApeX
  return {
    numero_fne: reponse.reference,                     // ex. "9606123E25000000019"
    hash_facture: calculerHash(facture, reponse.ncc || ncc),
    qr_data: reponse.token,                            // URL complète de vérification (déjà signée DGI)
    mode,
    balance_sticker: reponse.balance_sticker ?? null,  // stock restant
    warning: reponse.warning || false,                 // alerte stock bas
    dgi_invoice_id: reponse.invoice?.id || null,       // utile pour les avoirs (refund)
    dgi_response_raw: reponse,
  };
}

/**
 * Certifie un avoir (note de crédit) auprès de la DGI.
 * Nécessite l'`id` DGI de la facture d'origine (récupéré au moment de
 * sa certification dans `dgi_invoice_id`).
 *
 * @param {object} args
 * @param {object} args.entreprise
 * @param {string} args.factureOriginaleDgiId  — UUID retourné par la DGI
 * @param {array}  args.items                  — [{ id: <itemDgiId>, quantity: N }]
 */
async function certifierAvoir({ entreprise, factureOriginaleDgiId, items }) {
  const mode = entreprise.fne_mode || 'mock';
  if (mode === 'mock' || !entreprise.fne_api_key) {
    const numeroFne = genererNumeroFneMock();
    return {
      numero_fne: `A-${numeroFne}`,
      mode: 'mock',
      dgi_response_raw: { simulated: true, refund_of: factureOriginaleDgiId },
    };
  }

  const baseUrl = DGI_BASE_URLS[mode];
  if (!baseUrl) {
    throw new FneNetworkError(`Mode FNE '${mode}' : URL DGI non configurée pour les avoirs.`);
  }

  const url = `${baseUrl}/external/invoices/${factureOriginaleDgiId}/refund`;
  const reponse = await appelerDgi({
    url, apiKey: entreprise.fne_api_key,
    payload: { items },
  });

  return {
    numero_fne: reponse.reference,
    qr_data: reponse.token,
    mode,
    balance_sticker: reponse.balance_sticker ?? null,
    warning: reponse.warning || false,
    dgi_response_raw: reponse,
  };
}

// ─── Ping DGI ────────────────────────────────────────────────────────────
// Pas d'endpoint /health documenté côté DGI. On fait un GET sur la base
// URL pour vérifier que le serveur répond (n'importe quel code HTTP < 500
// est considéré comme « DGI joignable »).
async function pingDgi(entreprise) {
  const mode = entreprise.fne_mode || 'mock';
  if (mode === 'mock') {
    return { statut: 'mock', message: 'Mode démonstration — aucun appel DGI' };
  }
  if (!entreprise.ncc || !entreprise.fne_api_key) {
    return { statut: 'unconfigured', message: 'NCC ou clé API DGI manquant' };
  }

  const baseUrl = DGI_BASE_URLS[mode];
  if (!baseUrl) {
    return { statut: 'unconfigured', message: `URL DGI non configurée pour le mode ${mode}` };
  }

  const controleur = new AbortController();
  const timeout = setTimeout(() => controleur.abort(), 4000);
  try {
    const reponse = await fetch(baseUrl, {
      method: 'GET',
      signal: controleur.signal,
      headers: { 'Accept': 'application/json' },
    });
    // < 500 = le serveur répond, c'est joignable (400/401/404 OK ici)
    if (reponse.status < 500) {
      return { statut: 'ok', message: `DGI ${mode} OK (HTTP ${reponse.status})` };
    }
    return { statut: 'down', message: `DGI ${mode} HTTP ${reponse.status}` };
  } catch (err) {
    const motif = err.name === 'AbortError' ? 'timeout 4s' : err.message;
    return { statut: 'down', message: `DGI ${mode} injoignable (${motif})` };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  certifierFacture,
  certifierAvoir,
  calculerHash,
  construirePayloadDgi,   // exposé pour les tests
  templateClient,
  codeTvaDgi,
  pingDgi,
  FneNetworkError,
  FneAuthError,
  DGI_BASE_URLS,          // exposé pour la doc et la config UI
};
