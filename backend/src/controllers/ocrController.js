/**
 * Contrôleur OCR — exposé via POST /api/ocr/scanner.
 *
 * Le frontend envoie l'image en base64 dans le body JSON (pas de multipart
 * pour rester simple côté Express). Limite implicite : la taille max du
 * body JSON configurée dans src/index.js (50 MB par défaut).
 *
 * Réponse : voir backend/src/utils/ocr.js#extraireFacture pour le format.
 */

const { extraireFacture } = require('../utils/ocr');
const { body, validationResult } = require('express-validator');
const { logAudit } = require('../utils/audit');
const { incrementerOcr } = require('./abonnementController');

// Validation : on accepte uniquement les types courants pour les factures
// (photo téléphone ou export scanner). PDF non géré par pixtral, sera
// ajouté quand on migrera vers Mistral OCR document.
const TYPES_AUTORISES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const scannerRules = [
  body('image_base64').isString().notEmpty().withMessage('Image requise'),
  body('mime_type').optional().isIn(TYPES_AUTORISES).withMessage('Type de fichier non supporté'),
];

async function scannerPiece(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Données invalides', errors: errors.array() });
    }

    const { image_base64, mime_type = 'image/jpeg' } = req.body;

    // Garde-fou taille : on n'envoie pas à Mistral des images > 8 MB
    // (limite raisonnable pour une photo de facture compressée par le
    // navigateur). Au-delà, on demande au client de recompresser.
    const tailleApprox = (image_base64.length * 3) / 4;
    if (tailleApprox > 8 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: 'Image trop volumineuse (max 8 MB). Veuillez réduire la résolution.',
      });
    }

    const resultat = await extraireFacture({
      imageBase64: image_base64.replace(/^data:[^;]+;base64,/, ''),
      mimeType: mime_type,
    });

    // On ne consomme un crédit de quota que si l'extraction est réelle
    // (mode mistral) ; le mock et le mock_fallback restent gratuits pour
    // ne pas pénaliser l'utilisateur quand notre API est indisponible.
    if (resultat.mode === 'mistral') {
      await incrementerOcr(req.entrepriseId).catch(e =>
        console.warn('[ocr] incrément compteur échoué:', e.message)
      );
    }

    // On journalise l'action (utile pour facturation API et debug),
    // mais sans stocker l'image elle-même pour limiter la rétention.
    logAudit(req, 'SCAN', 'ocr', null, {
      mode: resultat.mode,
      confiance: resultat.confiance,
      fournisseur: resultat.fournisseur_nom,
      ttc: resultat.montant_ttc,
    });

    res.json({ success: true, data: resultat });
  } catch (err) {
    next(err);
  }
}

module.exports = { scannerPiece, scannerRules };
