/**
 * Middleware de quota — refuse une opération si le palier d'abonnement
 * actuel a atteint son plafond.
 *
 * Usage :
 *   router.post('/factures', auth, can(...), checkQuota('factures'), createFacture);
 *   router.post('/ocr/scanner', auth, can(...), checkQuota('ocr'), scannerPiece);
 *
 * Codes de quota gérés :
 *   - factures      : limite factures_mois (calendaire)
 *   - ocr           : limite ocr_scans_mois (avec reset auto)
 *   - utilisateurs  : limite nb membres de l'entreprise
 *   - entreprises   : limite nb entreprises pour un même propriétaire
 *   - paie          : limite paie_bulletins/mois
 *   - immobilisations : module booléen (true/false)
 *   - api           : module booléen (true/false)
 *
 * Le middleware répond 402 (Payment Required) quand le quota est dépassé,
 * avec un corps explicite qui permet au frontend d'afficher un appel à
 * l'upgrade plutôt qu'une erreur générique.
 */

const { getAbonnementActif, calculerUsage } = require('../controllers/abonnementController');
const { getQuotas } = require('../utils/quotas');

function checkQuota(typeQuota) {
  return async (req, res, next) => {
    try {
      const abo = await getAbonnementActif(req.entrepriseId);
      const quotas = getQuotas(abo.palier);

      // Modules booléens : refus si le module entier est désactivé sur le palier.
      if (typeQuota === 'immobilisations' && !quotas.immobilisations) {
        return refus(res, abo.palier, 'immobilisations');
      }
      if (typeQuota === 'api' && !quotas.api_publique) {
        return refus(res, abo.palier, 'api');
      }
      // Le module paie est traité comme un booléen "disponible / non" :
      // si le palier autorise 0 bulletin/mois, on bloque toute écriture.
      // Le quota chiffré reste utile à l'affichage (compteur d'usage).
      if (typeQuota === 'paie' && (!quotas.paie_bulletins || quotas.paie_bulletins === 0)) {
        return refus(res, abo.palier, 'paie');
      }
      // Idem Mobile Money : si le palier n'autorise aucun fournisseur
      // simultané, on bloque la création d'intégration de paiement.
      if (typeQuota === 'paiement_fournisseurs' && (!quotas.paiement_fournisseurs || quotas.paiement_fournisseurs === 0)) {
        return refus(res, abo.palier, 'paiement_fournisseurs');
      }

      // Quotas chiffrés : on calcule l'usage actuel et on compare.
      const usage = await calculerUsage(req.entrepriseId);
      const map = {
        factures:      { used: usage.factures_mois,   max: quotas.factures_mois },
        ocr:           { used: usage.ocr_scans_mois,  max: quotas.ocr_scans_mois },
        utilisateurs:  { used: usage.utilisateurs,    max: quotas.utilisateurs },
        entreprises:   { used: usage.entreprises,     max: quotas.entreprises },
      };
      const m = map[typeQuota];
      if (!m) return next(); // type inconnu : on laisse passer (fail-open par sécurité prod)

      if (m.max !== Infinity && m.used >= m.max) {
        return refus(res, abo.palier, typeQuota, m);
      }

      next();
    } catch (err) {
      // En cas d'erreur de lecture (BD HS, table abonnements absente sur
      // un déploiement non migré), on ouvre les vannes pour ne pas
      // casser le service. L'erreur reste loggée pour debug.
      console.warn('[checkQuota] erreur lecture quota, fail-open:', err.message);
      next();
    }
  };
}

function refus(res, palierActuel, typeQuota, infos = null) {
  return res.status(402).json({
    success: false,
    code: 'QUOTA_ATTEINT',
    type_quota: typeQuota,
    palier_actuel: palierActuel,
    usage: infos ? infos.used : null,
    plafond: infos ? infos.max : null,
    message: `Limite atteinte sur votre palier « ${palierActuel} ». Passez à un palier supérieur pour continuer.`,
  });
}

module.exports = checkQuota;
