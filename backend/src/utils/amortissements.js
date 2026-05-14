/**
 * Moteur de calcul des amortissements
 * ============================================================================
 * Implémente le calcul des dotations annuelles pour les immobilisations,
 * conformément à SYSCOHADA :
 *
 *   - **Linéaire** : la dotation annuelle est constante = base / durée.
 *     Le prorata temporis s'applique sur la 1re et la dernière année.
 *
 *   - **Dégressif** : taux = (1/durée) × coefficient, appliqué à la VNC.
 *     Le prorata s'applique sur la 1re année. Quand la dotation linéaire
 *     sur la durée résiduelle devient supérieure à la dotation dégressive,
 *     on bascule en linéaire.
 *
 * Les valeurs sont arrondies à 2 décimales. Le dernier exercice ajuste la
 * dotation pour que la somme cumulée corresponde exactement à la base.
 * ============================================================================
 */

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

/**
 * Nombre de jours d'amortissement sur une période donnée, base 365 jours.
 * Si l'immobilisation entre en service en cours d'année, on amortit
 * proportionnellement au nombre de jours restants.
 */
const joursAmortis = (debutPeriode, finPeriode, miseEnService, dateSortie) => {
  const d0 = new Date(Math.max(new Date(debutPeriode), new Date(miseEnService)));
  const dFin = dateSortie
    ? new Date(Math.min(new Date(finPeriode), new Date(dateSortie)))
    : new Date(finPeriode);
  if (dFin < d0) return 0;
  // +1 pour inclure le jour de mise en service
  return Math.max(0, Math.floor((dFin - d0) / (1000 * 60 * 60 * 24)) + 1);
};

/**
 * Calcule le plan d'amortissement complet d'une immobilisation.
 *
 * @param {Object} immo
 *   - valeur_acquisition : valeur d'achat HT
 *   - valeur_residuelle  : valeur en fin de plan (par défaut 0)
 *   - date_mise_en_service (ou date_acquisition par défaut)
 *   - duree_annees       : durée d'amortissement
 *   - methode            : 'lineaire' (défaut) ou 'degressif'
 *   - coefficient_degressif : 1.5 / 2 / 2.5 (selon durée)
 *   - date_sortie        : optionnel, si l'immo est cédée/au rebut
 *
 * @returns {Array<{annee, jours_amortis, taux, base_amortissable, vnc_debut,
 *                  dotation, cumul_amortissements, vnc_fin}>}
 */
const planAmortissement = (immo) => {
  const valeur = parseFloat(immo.valeur_acquisition) || 0;
  const residuelle = parseFloat(immo.valeur_residuelle) || 0;
  const base = round2(valeur - residuelle);
  const duree = parseFloat(immo.duree_annees);
  const methode = immo.methode || 'lineaire';
  const coeffDeg = parseFloat(immo.coefficient_degressif) || 1;
  const miseEnService = immo.date_mise_en_service || immo.date_acquisition;
  if (!miseEnService || !duree || duree <= 0 || base <= 0) return [];

  const dateDebut = new Date(miseEnService);
  const anneeDebut = dateDebut.getFullYear();
  const dateSortie = immo.date_sortie ? new Date(immo.date_sortie) : null;

  // Année théorique de fin = mise en service + durée. On déborde d'un an pour
  // que la dernière fraction (prorata) soit couverte.
  const anneeFinTheorique = anneeDebut + Math.ceil(duree);

  const plan = [];
  let cumul = 0;
  const tauxLineaire = 1 / duree;            // ex : 0,2 pour 5 ans
  const tauxDegressif = tauxLineaire * coeffDeg;

  for (let annee = anneeDebut; annee <= anneeFinTheorique + 1; annee++) {
    const debutAnnee = `${annee}-01-01`;
    const finAnnee = `${annee}-12-31`;
    const jours = joursAmortis(debutAnnee, finAnnee, miseEnService, dateSortie?.toISOString().slice(0,10));
    if (jours <= 0 && cumul > 0) break;   // après la sortie ou hors période
    if (jours <= 0) continue;

    const vncDebut = round2(valeur - cumul);
    let dotation;

    if (methode === 'degressif') {
      // Bascule en linéaire si la dotation linéaire sur le reste de la durée
      // devient supérieure (règle SYSCOHADA/CGI).
      const anneesRestantes = Math.max(1, duree - (annee - anneeDebut));
      const dotLineaireRestante = round2((vncDebut - residuelle) / anneesRestantes);
      const dotDegressive = round2(vncDebut * tauxDegressif * (jours / 365));
      dotation = Math.max(dotDegressive, dotLineaireRestante);
    } else {
      // Linéaire : base × taux × prorata
      dotation = round2(base * tauxLineaire * (jours / 365));
    }

    // Garde-fous : ne pas dépasser le cumul max (base) ni la VNC restante
    const cumulMax = round2(base);
    if (round2(cumul + dotation) > cumulMax) {
      dotation = round2(cumulMax - cumul);
    }
    if (dotation <= 0) break;

    cumul = round2(cumul + dotation);
    const vncFin = round2(valeur - cumul);

    plan.push({
      annee,
      jours_amortis: jours,
      taux: round2((methode === 'degressif' ? tauxDegressif : tauxLineaire) * 100),
      base_amortissable: base,
      vnc_debut: vncDebut,
      dotation,
      cumul_amortissements: cumul,
      vnc_fin: vncFin,
    });

    if (cumul >= cumulMax || vncFin <= residuelle) break;
  }

  // Ajustement final : si dernière ligne a une mini erreur d'arrondi, on
  // rectifie pour que vnc_fin === valeur_residuelle exactement.
  if (plan.length > 0) {
    const last = plan[plan.length - 1];
    const ecart = round2(last.vnc_fin - residuelle);
    if (Math.abs(ecart) < 1 && ecart !== 0) {
      last.dotation = round2(last.dotation + ecart);
      last.cumul_amortissements = round2(last.cumul_amortissements + ecart);
      last.vnc_fin = round2(residuelle);
    }
  }

  return plan;
};

/**
 * Renvoie la dotation prévue pour une année donnée à partir d'un plan complet.
 * Utile pour générer une seule écriture au moment de la clôture d'exercice.
 */
const dotationPourAnnee = (immo, annee) => {
  const plan = planAmortissement(immo);
  return plan.find(p => p.annee === parseInt(annee)) || null;
};

/**
 * Calcule la VNC actuelle à partir des dotations déjà passées.
 * Si le plan complet a été passé, vnc = valeur_acquisition − cumul.
 */
const vncActuelle = (immo, dotationsExistantes = []) => {
  const valeur = parseFloat(immo.valeur_acquisition) || 0;
  const cumul = dotationsExistantes.reduce((s, d) => s + parseFloat(d.dotation || 0), 0);
  return round2(valeur - cumul);
};

/**
 * Coefficient dégressif standard CI selon la durée.
 * Source : CGI CI Annexe IV.
 */
const coefficientDegressifStandard = (duree) => {
  if (duree <= 4) return 1.5;
  if (duree <= 6) return 2;
  return 2.5;
};

module.exports = {
  planAmortissement,
  dotationPourAnnee,
  vncActuelle,
  coefficientDegressifStandard,
  joursAmortis,
};
