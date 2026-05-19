/**
 * Service FNE (Facture Normalisée Électronique) — DGI Côte d'Ivoire.
 *
 * Trois modes :
 *   - mock     : pas d'appel externe. Génère un numéro FNE plausible
 *                préfixé `MOCK-` et un hash SHA-256 du payload signé en
 *                interne. Permet de démontrer la signature et le QR code
 *                sans dépendre du raccordement DGI.
 *   - sandbox  : appelle l'API DGI de pré-production. Le numéro est réel
 *                mais sans valeur fiscale.
 *   - prod     : appelle l'API DGI de production. Numéro fiscal opposable.
 *
 * Implémentation : seul le mode mock est branché aujourd'hui. Les modes
 * sandbox et prod sont prévus pour être complétés quand la DGI publiera
 * son SDK officiel (la spec actuelle ePXT est en cours de finalisation).
 * Pour l'instant ils retournent une erreur explicite côté contrôleur.
 *
 * Forme du payload normalisé (sert au calcul du hash) :
 *   numero|date|ncc_vendeur|montant_ht|montant_tva|montant_ttc|devise
 */

const crypto = require('crypto');

const URL_VERIFICATION_PUBLIQUE = 'https://verif.dgi.gouv.ci/fne';
// Endpoints prévus côté DGI (placeholders tant que le SDK officiel n'est
// pas publié). On les centralise ici pour qu'un seul endroit du code
// pointe vers les URLs réelles le jour de la mise en prod.
const DGI_BASE_URLS = {
  sandbox: 'https://sandbox.dgi.gouv.ci/fne/v1',
  prod:    'https://api.dgi.gouv.ci/fne/v1',
};

/**
 * Calcule le hash de contrôle d'une facture. C'est la même règle que celle
 * documentée par l'eTaxNI sénégalais et qui sera reprise par la CI :
 * pipe-separated → SHA-256 → hex.
 */
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

/**
 * Génère un numéro FNE plausible. En prod la DGI renvoie un identifiant
 * unique formé d'un préfixe année + 10 chiffres. En mock on préfixe `MOCK-`
 * pour que personne ne le confonde avec un vrai numéro.
 */
function genererNumeroFneMock() {
  const annee = new Date().getFullYear();
  const sequence = String(Math.floor(Math.random() * 9_999_999_999)).padStart(10, '0');
  return `MOCK-${annee}${sequence}`;
}

/**
 * Construit la chaîne encodée dans le QR code. Le format est inspiré de
 * la norme EN 16931 (facture européenne) adaptée pour la DGI CI :
 * URL publique + paramètres signés. Quand le client scanne, il arrive
 * sur la page de vérification DGI qui confirme la facture.
 */
function construireQrData(numeroFne, hash) {
  const params = new URLSearchParams({ fne: numeroFne, h: hash });
  return `${URL_VERIFICATION_PUBLIQUE}?${params.toString()}`;
}

/**
 * Erreur typée pour distinguer une panne réseau (à mettre en queue) d'une
 * erreur métier (config invalide, hash refusé, NCC inconnu — pas de retry).
 */
class FneNetworkError extends Error {
  constructor(message) { super(message); this.name = 'FneNetworkError'; }
}

/**
 * Point d'entrée du service. La facture passée doit contenir au minimum
 * { numero, date_facture, total_ht, total_tva, total_ttc, devise }.
 */
async function certifierFacture({ facture, entreprise }) {
  const mode = entreprise.fne_mode || 'mock';
  const ncc = entreprise.ncc || null;

  if (mode === 'mock' || !entreprise.fne_api_key) {
    const numeroFne = genererNumeroFneMock();
    const hash = calculerHash(facture, ncc);
    return {
      numero_fne: numeroFne,
      hash_facture: hash,
      qr_data: construireQrData(numeroFne, hash),
      mode: 'mock',
      dgi_response_raw: { simulated: true, generated_at: new Date().toISOString() },
    };
  }

  // Branchement DGI réel : à compléter quand le SDK officiel sera publié.
  // En attendant on lève une FneNetworkError pour que le contrôleur la
  // pousse en queue (l'admin verra que sa config sandbox/prod est en
  // attente de raccordement) plutôt qu'une 500 brutale.
  throw new FneNetworkError(
    `Mode FNE '${mode}' non encore branché. Repassez en mode 'mock' ou attendez la publication du SDK DGI.`
  );
}

/**
 * Ping de l'API DGI — retourne un statut synthétique pour l'écran
 * Paramètres → Fiscal. Pas d'effet de bord en BD ; c'est le contrôleur
 * qui décide de mettre le résultat en cache.
 *
 * Statuts possibles :
 *   - mock         : entreprise en mode mock — l'icône reste neutre.
 *   - unconfigured : mode sandbox/prod mais NCC ou clé API manquant(e).
 *   - ok           : ping HTTP DGI réussi (HEAD < 4s).
 *   - down         : ping échoué (timeout, 5xx, DNS, etc.).
 */
async function pingDgi(entreprise) {
  const mode = entreprise.fne_mode || 'mock';
  if (mode === 'mock') {
    return { statut: 'mock', message: 'Mode démonstration — aucun appel DGI' };
  }
  if (!entreprise.ncc || !entreprise.fne_api_key) {
    return { statut: 'unconfigured', message: 'NCC ou clé API DGI manquant' };
  }

  const url = `${DGI_BASE_URLS[mode]}/health`;
  // AbortController disponible nativement sur Node 18+ (≥ Node 20 ici).
  const controleur = new AbortController();
  const timeout = setTimeout(() => controleur.abort(), 4000);
  try {
    const reponse = await fetch(url, {
      method: 'HEAD',
      signal: controleur.signal,
      headers: { 'X-API-Key': entreprise.fne_api_key },
    });
    if (reponse.ok) return { statut: 'ok', message: `DGI ${mode} OK` };
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
  calculerHash,
  construireQrData,
  pingDgi,
  FneNetworkError,
};
