/**
 * Service OCR — extraction structurée de factures et reçus.
 *
 * Deux modes :
 *   - mock     : pas d'appel externe, retourne une facture plausible
 *                (utile pour démos commerciales et tests E2E).
 *   - mistral  : utilise pixtral (Mistral Vision) pour extraire un JSON
 *                structuré directement depuis l'image. Clé d'API dans
 *                la variable d'env MISTRAL_API_KEY.
 *
 * Format de sortie normalisé (toutes valeurs en FCFA, dates ISO) :
 *   {
 *     fournisseur_nom, fournisseur_ifu,
 *     date, numero,
 *     montant_ht, montant_tva, montant_ttc, taux_tva,
 *     devise, lignes: [{description, quantite, prix_unitaire, montant_ht}],
 *     confiance (0..1),
 *     mode ('mock' | 'mistral'),
 *   }
 *
 * Le contrôleur consomme directement cette forme et pré-remplit le
 * formulaire de dépense ou de facture fournisseur côté frontend.
 */

const PROMPT_EXTRACTION = `Tu es un assistant d'extraction de données comptables pour le marché ivoirien (SYSCOHADA).
Analyse cette image de facture/reçu et retourne UNIQUEMENT un JSON strict (sans markdown, sans commentaire) avec ces champs :

{
  "fournisseur_nom": "string (raison sociale du vendeur, en MAJUSCULES si possible)",
  "fournisseur_ifu": "string ou null (numéro IFU/RCCM si présent)",
  "date": "YYYY-MM-DD",
  "numero": "string ou null (numéro de facture/reçu)",
  "montant_ht": number (en FCFA, sans séparateur),
  "montant_tva": number,
  "montant_ttc": number,
  "taux_tva": number (en %, ex: 18),
  "devise": "XOF",
  "lignes": [{"description": "string", "quantite": number, "prix_unitaire": number, "montant_ht": number}],
  "confiance": number (0..1, ta certitude globale sur l'extraction)
}

Règles :
- Si la facture est en devise étrangère, convertis approximativement en FCFA (1 EUR ≈ 655 FCFA, 1 USD ≈ 600 FCFA).
- Si un champ est absent ou illisible, mets null (sauf montants : mets 0).
- Si la TVA n'est pas explicite, déduis-la : montant_tva = montant_ttc - montant_ht.
- Réponds en UN SEUL bloc JSON, rien d'autre.`;

/**
 * Génère un mock plausible (fournisseur ivoirien type, montants cohérents).
 * Utilisé en l'absence de clé Mistral pour permettre la démo commerciale.
 */
function genererMock() {
  const fournisseurs = [
    { nom: 'STAR SARL',           ifu: '9601234A' },
    { nom: 'PROSUMA',             ifu: '7501122B' },
    { nom: 'TOTAL ENERGIES CI',   ifu: '5500987C' },
    { nom: 'CARRÉ D\'OR',         ifu: '8200456D' },
    { nom: 'NSIA TECH SUPPLY',    ifu: '6300789E' },
  ];
  const f = fournisseurs[Math.floor(Math.random() * fournisseurs.length)];
  const ht = Math.round((Math.random() * 195000 + 5000) / 500) * 500;
  const tauxTva = 18;
  const tva = Math.round(ht * tauxTva / 100);
  const ttc = ht + tva;
  const today = new Date();
  today.setDate(today.getDate() - Math.floor(Math.random() * 14));
  return {
    fournisseur_nom: f.nom,
    fournisseur_ifu: f.ifu,
    date: today.toISOString().slice(0, 10),
    numero: `F-${today.getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    montant_ht: ht,
    montant_tva: tva,
    montant_ttc: ttc,
    taux_tva: tauxTva,
    devise: 'XOF',
    lignes: [
      { description: 'Fournitures et prestations diverses', quantite: 1, prix_unitaire: ht, montant_ht: ht },
    ],
    confiance: 0.92,
    mode: 'mock',
  };
}

/**
 * Appel pixtral-12b en mode JSON. L'image est passée en data URL base64.
 * Mistral Vision accepte data:image/* directement, pas besoin d'upload séparé.
 */
async function appelerMistral(imageBase64, mimeType, apiKey) {
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'pixtral-12b-2409',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT_EXTRACTION },
          { type: 'image_url', image_url: dataUrl },
        ],
      }],
      temperature: 0.1,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Mistral OCR error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const body = await res.json();
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('Mistral OCR : réponse vide');
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('Mistral OCR : JSON invalide');
  }
  // Normalisation : on garantit les champs et leurs types attendus côté
  // frontend, même si pixtral renvoie occasionnellement des strings.
  return {
    fournisseur_nom: data.fournisseur_nom || null,
    fournisseur_ifu: data.fournisseur_ifu || null,
    date: data.date || null,
    numero: data.numero || null,
    montant_ht:  Number(data.montant_ht)  || 0,
    montant_tva: Number(data.montant_tva) || 0,
    montant_ttc: Number(data.montant_ttc) || 0,
    taux_tva:    Number(data.taux_tva)    || 18,
    devise: data.devise || 'XOF',
    lignes: Array.isArray(data.lignes) ? data.lignes.map(l => ({
      description: l.description || '',
      quantite: Number(l.quantite) || 1,
      prix_unitaire: Number(l.prix_unitaire) || 0,
      montant_ht: Number(l.montant_ht) || 0,
    })) : [],
    confiance: Number(data.confiance) || 0.7,
    mode: 'mistral',
  };
}

/**
 * Point d'entrée unique du service. Retombe sur le mock si aucune clé
 * n'est configurée — ainsi les démos fonctionnent sans dépendance externe.
 */
async function extraireFacture({ imageBase64, mimeType = 'image/jpeg' }) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return genererMock();
  }
  try {
    return await appelerMistral(imageBase64, mimeType, apiKey);
  } catch (err) {
    // On ne casse pas le flux : si l'API tombe, on bascule sur le mock
    // avec un drapeau d'erreur pour que le frontend puisse alerter.
    return { ...genererMock(), mode: 'mock_fallback', erreur: err.message };
  }
}

module.exports = { extraireFacture };
