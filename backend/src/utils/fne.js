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
  // On préserve une erreur claire pour ne pas certifier silencieusement
  // en mock alors que l'utilisateur a activé la prod.
  throw new Error(`Mode FNE '${mode}' non encore branché. Repassez en mode 'mock' ou attendez la publication du SDK DGI.`);
}

module.exports = { certifierFacture, calculerHash, construireQrData };
