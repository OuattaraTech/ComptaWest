/**
 * Contrôleur d'abonnement — lecture du palier actif, consommation des
 * quotas et changement de palier.
 *
 * Routes :
 *   GET  /abonnement          → palier actif + compteurs d'usage
 *   PUT  /abonnement          → changer de palier (proprietaire/admin)
 *
 * La grille des limites est dans utils/quotas.js. Ce contrôleur ne fait
 * qu'orchestrer la lecture en BD et le calcul des compteurs d'usage.
 */

const pool = require('../../config/database');
const { getQuotas, PALIERS_ORDONNES } = require('../utils/quotas');
const { logAudit } = require('../utils/audit');

/**
 * Calcule les compteurs d'usage du mois en cours :
 *   - utilisateurs : nb membres actifs de l'entreprise
 *   - entreprises  : nb entreprises sous le même propriétaire
 *   - factures_mois : factures émises ce mois calendaire
 *   - ocr_scans_mois : compteur stocké sur entreprises (déjà reset
 *     automatiquement par incrementerOcr quand le mois change)
 */
// Wrapper résilient : exécute la requête, attrape les erreurs (table ou
// colonne inexistante, p. ex. quand la migration 022 n'a pas encore été
// appliquée), et renvoie une valeur par défaut. Évite qu'une 500 fasse
// disparaître entièrement l'onglet Abonnement côté UI.
async function safeQuery(sql, params, defaut) {
  try {
    const r = await pool.query(sql, params);
    return r;
  } catch (err) {
    console.warn('[abonnement] requête tolérée en échec :', err.code, err.message);
    return { rows: defaut };
  }
}

async function calculerUsage(entrepriseId) {
  const [users, ents, facts, ocr] = await Promise.all([
    safeQuery(
      `SELECT COUNT(*)::int AS n FROM membres_entreprise WHERE entreprise_id = $1`,
      [entrepriseId],
      [{ n: 1 }]
    ),
    safeQuery(
      `SELECT COUNT(DISTINCT e.id)::int AS n
         FROM entreprises e
         JOIN membres_entreprise me_self ON me_self.entreprise_id = $1 AND me_self.role = 'proprietaire'
         JOIN membres_entreprise me_other ON me_other.utilisateur_id = me_self.utilisateur_id AND me_other.role = 'proprietaire'
        WHERE e.id = me_other.entreprise_id`,
      [entrepriseId],
      [{ n: 1 }]
    ),
    safeQuery(
      `SELECT COUNT(*)::int AS n FROM factures
        WHERE entreprise_id = $1
          AND type = 'facture'
          AND statut <> 'brouillon'
          AND date_emission >= date_trunc('month', CURRENT_DATE)
          AND date_emission <  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`,
      [entrepriseId],
      [{ n: 0 }]
    ),
    safeQuery(
      `SELECT ocr_scans_mois_courant, ocr_scans_periode_mois, ocr_scans_periode_annee
         FROM entreprises WHERE id = $1`,
      [entrepriseId],
      [{}]
    ),
  ]);

  // Reset implicite si le compteur date d'un mois antérieur : on ne
  // touche pas la BD ici, on remet juste 0 dans la réponse. La BD sera
  // synchronisée à la prochaine incrementerOcr().
  const now = new Date();
  const moisCourant = now.getMonth() + 1;
  const anneeCourante = now.getFullYear();
  const ligne = ocr.rows[0] || {};
  const compteurOcr = (ligne.ocr_scans_periode_mois === moisCourant
    && ligne.ocr_scans_periode_annee === anneeCourante)
    ? (ligne.ocr_scans_mois_courant || 0)
    : 0;

  return {
    utilisateurs:    users.rows[0]?.n ?? 1,
    entreprises:     ents.rows[0]?.n || 1,
    factures_mois:   facts.rows[0]?.n ?? 0,
    ocr_scans_mois:  compteurOcr,
  };
}

async function getAbonnementActif(entrepriseId) {
  const r = await safeQuery(
    `SELECT palier, statut, periodicite, date_debut, date_fin, prix_mensuel_fcfa
       FROM abonnements WHERE entreprise_id = $1`,
    [entrepriseId],
    []
  );
  // Si la migration 022 n'a pas tourné ou si l'entreprise vient d'être
  // créée sans déclencheur, on retombe sur le palier découverte.
  return r.rows[0] || {
    palier: 'decouverte',
    statut: 'actif',
    periodicite: 'mensuel',
    date_debut: new Date().toISOString().slice(0, 10),
    date_fin: null,
    prix_mensuel_fcfa: 0,
  };
}

async function getAbonnement(req, res, next) {
  try {
    const abo = await getAbonnementActif(req.entrepriseId);
    const quotas = getQuotas(abo.palier);
    const usage = await calculerUsage(req.entrepriseId);

    // Indicateurs de proximité avec les plafonds, utile pour afficher
    // des barres de progression côté UI sans recalculer à chaque rendu.
    const pct = (used, max) => max === Infinity ? 0 : Math.min(100, Math.round((used / max) * 100));

    res.json({
      success: true,
      data: {
        abonnement: abo,
        quotas: {
          ...quotas,
          // Infinity ne survit pas à JSON.stringify — on le remplace
          // par null pour signifier « illimité » au frontend.
          utilisateurs:    quotas.utilisateurs === Infinity ? null : quotas.utilisateurs,
          factures_mois:   quotas.factures_mois === Infinity ? null : quotas.factures_mois,
          paie_bulletins:  quotas.paie_bulletins === Infinity ? null : quotas.paie_bulletins,
        },
        usage: {
          ...usage,
          pourcentages: {
            utilisateurs:    pct(usage.utilisateurs,   quotas.utilisateurs),
            factures_mois:   pct(usage.factures_mois,  quotas.factures_mois),
            ocr_scans_mois:  pct(usage.ocr_scans_mois, quotas.ocr_scans_mois),
          },
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Changement de palier — pour le MVP on accepte un changement direct
 * sans flux de paiement (l'admin SaaS valide manuellement la facture).
 * On enregistre le prix appliqué pour traçabilité commerciale.
 */
async function putAbonnement(req, res, next) {
  try {
    const { palier, periodicite = 'mensuel', notes_commerciales } = req.body;
    if (!PALIERS_ORDONNES.includes(palier)) {
      return res.status(400).json({ success: false, message: 'Palier invalide' });
    }
    if (!['mensuel', 'annuel'].includes(periodicite)) {
      return res.status(400).json({ success: false, message: 'Périodicité invalide' });
    }

    const quotas = getQuotas(palier);
    const prix = periodicite === 'annuel'
      ? Math.round(quotas.prix_annuel / 12)
      : quotas.prix_mensuel;

    // UPSERT pour gérer le cas où la ligne n'existe pas encore (entreprise
    // créée avant la migration ou via un flux qui n'a pas créé l'abo).
    await pool.query(
      `INSERT INTO abonnements
         (entreprise_id, palier, statut, periodicite, date_debut, prix_mensuel_fcfa, notes_commerciales)
       VALUES ($1, $2, 'actif', $3, CURRENT_DATE, $4, $5)
       ON CONFLICT (entreprise_id) DO UPDATE
         SET palier = EXCLUDED.palier,
             statut = 'actif',
             periodicite = EXCLUDED.periodicite,
             prix_mensuel_fcfa = EXCLUDED.prix_mensuel_fcfa,
             notes_commerciales = COALESCE(EXCLUDED.notes_commerciales, abonnements.notes_commerciales),
             updated_at = NOW()`,
      [req.entrepriseId, palier, periodicite, prix, notes_commerciales || null]
    );

    logAudit(req, 'UPDATE', 'abonnement', null, { palier, periodicite });

    return getAbonnement(req, res, next);
  } catch (err) {
    next(err);
  }
}

/**
 * Incrémente le compteur de scans OCR. Appelée juste après un scan
 * réussi en mode réel (le mock n'est pas comptabilisé). Gère le reset
 * mensuel automatique : si le mois ou l'année stockés diffèrent du
 * mois courant, on remet 1 au lieu d'incrémenter.
 */
async function incrementerOcr(entrepriseId) {
  const now = new Date();
  const mois  = now.getMonth() + 1;
  const annee = now.getFullYear();

  await pool.query(
    `UPDATE entreprises
        SET ocr_scans_mois_courant = CASE
              WHEN ocr_scans_periode_mois = $2 AND ocr_scans_periode_annee = $3
                THEN ocr_scans_mois_courant + 1
              ELSE 1
            END,
            ocr_scans_periode_mois  = $2,
            ocr_scans_periode_annee = $3,
            updated_at = NOW()
      WHERE id = $1`,
    [entrepriseId, mois, annee]
  );
}

module.exports = {
  getAbonnement,
  putAbonnement,
  // Exposés pour les autres contrôleurs (middleware checkQuota)
  getAbonnementActif,
  calculerUsage,
  incrementerOcr,
};
