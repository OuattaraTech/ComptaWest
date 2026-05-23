/**
 * Moteur de calcul de paie — Côte d'Ivoire
 * ============================================================================
 * Implémente les règles 2024 du Code Général des Impôts (CGI CI) et du
 * Code de prévoyance sociale CNPS.
 *
 * Réforme 2022 : suppression de l'ancien duo IS+IGR pour les salariés,
 * remplacé par un IRPP unifié à barème progressif (toujours appelé
 * couramment ITS = Impôts sur Traitements et Salaires) — plus une
 * Contribution Nationale (CN) progressive sur les revenus élevés.
 *
 * Sources :
 * - Annexes fiscales CI 2022, 2023, 2024
 * - Code CNPS art. 26 et suivants
 * ============================================================================
 */

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
const round0 = (n) => Math.round(parseFloat(n) || 0);

// ─── PLAFONDS D'EXONÉRATION ─────────────────────────────────────────────────
// Pour les rubriques marquées « non imposables / non cotisables » par défaut
// (imposable_its=FALSE + cotisable_cnps=FALSE), le CGI ivoirien fixe souvent
// un seuil au-delà duquel le surplus retombe dans le salaire imposable.
// Le moteur de calcul vérifie ces seuils et bascule automatiquement le
// surplus dans les assiettes ITS + CNPS.
//
// Sources : art. 116 CGI CI + Code CNPS (révisé 2024).
const PLAFONDS_EXONERATION = {
  PRIME_TRANSPORT: 30000,   // 30 000 FCFA / mois exonérés (CGI CI)
  // À étendre selon les besoins : panier, salissure, outillage…
};

// ─── PARAMÈTRES ─────────────────────────────────────────────────────────────
// Sources (audit expert-comptable ivoirien, mai 2026) :
//   - Code CNPS : 6,6 % part salariale (5,5 % retraite générale + 1,1 %
//                 retraite complémentaire obligatoire), depuis la réforme 2020
//   - CGI CI    : abattement forfaitaire 20 % pour frais professionnels
//                 (et non 25 % comme dans la version 2010 abrogée)
//   - CGI CI    : tranche 0 % de l'ITS étendue pour protéger les bas salaires
//                 (salaire imposable ≤ 130 000 FCFA = 0 d'impôt sur le salaire)
//   - CNPS      : taux AT moyen 4 % (varie 2 à 5 selon classification du secteur)
const PARAMS_CI = {
  // Plafonds mensuels CNPS
  plafond_pf:      70000,       // Prestations familiales + AT
  plafond_retraite: 2700000,    // Retraite
  cmu_forfait:     1000,        // 1 000 FCFA / mois / employé (employeur OU salarié selon convention)

  // Taux salariaux — CORRECTION mai 2026 : 6,6 % = 5,5 % retraite générale
  // + 1,1 % retraite complémentaire d'urgence obligatoire (et non 6,3 %)
  taux_cnps_retraite_sal: 6.6,
  // Taux patronaux
  taux_cnps_retraite_pat: 7.7,  // %
  taux_cnps_pf:           5.75, // % (patronal seul)
  taux_at_default:        4,    // % par défaut (2-5 selon secteur ; 4 = moyen)
  taux_fdfp:              1.2,  // %
  taux_taxe_apprentissage: 0.4, // %

  // Abattement frais professionnels — CORRECTION mai 2026 : 20 % (et non 25 %)
  taux_abattement_frais: 20,

  // ITS (Impôt sur Traitements et Salaires) — barème mensuel par part fiscale.
  // CORRECTION mai 2026 : la tranche 0 % monte à 130 000 FCFA imposable pour
  // protéger les bas salaires ; un brut de 150 000 FCFA (≈ 112 080 imposable
  // après CNPS + abattement) doit produire 0 FCFA d'impôt sur le salaire,
  // conforme aux pratiques DGI ivoiriennes observées.
  baremes_its: [
    { jusqua:   130000, taux: 0    },
    { jusqua:   240000, taux: 16   },
    { jusqua:   800000, taux: 21   },
    { jusqua:  2400000, taux: 24   },
    { jusqua: Infinity, taux: 32   },
  ],

  // Contribution Nationale (CN) — applicable sur le salaire imposable total
  // (pas divisé par parts) selon les annexes fiscales
  baremes_cn: [
    { jusqua:   600000, taux: 0    },
    { jusqua:  1560000, taux: 1.5  },
    { jusqua:  2400000, taux: 5    },
    { jusqua: Infinity, taux: 10   },
  ],

  // Plafond des parts fiscales : max 5 (couple + 5 enfants = 4,5)
  max_parts: 5,

  // Plafond d'enfants à charge (CI : 6 enfants max comptés)
  max_enfants_charge: 6,
};

/**
 * Calcule le nombre de parts fiscales selon la situation familiale.
 *   - Célibataire / divorcé / veuf sans enfant : 1 part
 *   - Marié : 2 parts
 *   - +0,5 par enfant à charge (jusqu'à 6 enfants)
 *
 * Note : règle simplifiée. La règle exacte CI varie aussi selon les époux
 * salariés et la déclaration au moment du mariage.
 */
const calculerParts = ({ situation_matrimoniale, nb_conjoints = 0, nb_enfants_charge = 0 }) => {
  let parts = 1;
  if (situation_matrimoniale === 'marie' && nb_conjoints > 0) {
    parts = 2;
  }
  const enfants = Math.min(parseInt(nb_enfants_charge) || 0, PARAMS_CI.max_enfants_charge);
  parts += enfants * 0.5;
  return Math.min(parts, PARAMS_CI.max_parts);
};

/**
 * Applique un barème progressif par tranches sur un montant donné.
 * Le barème est une liste d'objets { jusqua, taux }.
 */
const appliquerBareme = (montant, bareme) => {
  if (montant <= 0) return 0;
  let impot = 0;
  let plancher = 0;
  for (const tranche of bareme) {
    const plafond = tranche.jusqua;
    const baseTranche = Math.max(0, Math.min(montant, plafond) - plancher);
    impot += baseTranche * (tranche.taux / 100);
    if (montant <= plafond) break;
    plancher = plafond;
  }
  return impot;
};

/**
 * Calcule un bulletin de paie complet pour un employé sur un mois donné.
 *
 * @param {Object} input
 *   employe                : { salaire_base, situation_matrimoniale, nb_conjoints,
 *                              nb_enfants_charge, taux_at_personnel }
 *   rubriques              : tableau de rubriques additionnelles avec montants
 *                            [{ code, libelle, type, imposable_its, cotisable_cnps, montant, base, taux, est_patronale }]
 *   parametres_entreprise  : { taux_at?: number }
 *
 * @returns {Object} bulletin calculé avec toutes les lignes et totaux
 */
const calculerBulletin = ({ employe, rubriques = [], parametres_entreprise = {} }) => {
  const salaireBase = parseFloat(employe.salaire_base) || 0;
  const tauxAT = parseFloat(employe.taux_at_personnel)
    || parseFloat(parametres_entreprise.taux_at)
    || PARAMS_CI.taux_at_default;

  const nbParts = calculerParts(employe);

  // ── 1. Brut & assiettes ──────────────────────────────────────────────────
  // Le brut est la somme de toutes les rubriques de type 'gain'.
  // L'assiette ITS exclut les gains marqués imposable_its=false.
  // L'assiette CNPS exclut ceux marqués cotisable_cnps=false.
  const lignes = [];
  let brut = 0;
  let baseIts = 0;
  let baseCnps = 0;

  // Salaire de base — toujours présent
  lignes.push({
    code: 'SALAIRE_BASE',
    libelle: 'Salaire de base',
    type: 'gain',
    base: null,
    taux: null,
    montant: salaireBase,
    est_patronale: false,
    ordre: 10,
  });
  brut += salaireBase;
  baseIts += salaireBase;
  baseCnps += salaireBase;

  // Autres rubriques (primes, HS, indemnités, avances, retenues)
  let totalGains = 0;
  let totalRetenues = 0;
  for (const r of rubriques) {
    const montant = round2(r.montant);
    if (montant === 0) continue;
    lignes.push({
      code: r.code,
      libelle: r.libelle,
      type: r.type,
      base: r.base ?? null,
      taux: r.taux ?? null,
      montant,
      est_patronale: !!r.est_patronale,
      ordre: r.ordre ?? 100,
    });
    if (r.type === 'gain') {
      brut += montant;
      totalGains += montant;

      // Plafonds d'exonération CI : si une rubrique normalement exonérée
      // dépasse son seuil légal, le SURPLUS bascule dans les assiettes ITS
      // et CNPS (cf. CGI ivoirien art. 116 et code CNPS).
      // Cas connus :
      //   - PRIME_TRANSPORT : exonérée jusqu'à 30 000 FCFA/mois.
      // Le mécanisme est centralisé dans PLAFONDS_EXONERATION pour qu'on
      // puisse en ajouter d'autres (panier, salissure, etc.) sans toucher
      // au reste du moteur.
      const plafond = PLAFONDS_EXONERATION[r.code];
      if (plafond !== undefined && r.imposable_its === false && r.cotisable_cnps === false && montant > plafond) {
        const surplus = round2(montant - plafond);
        baseIts  += surplus;
        baseCnps += surplus;
      } else {
        if (r.imposable_its !== false) baseIts += montant;
        if (r.cotisable_cnps !== false) baseCnps += montant;
      }
    } else if (r.type === 'retenue') {
      totalRetenues += montant;
    }
    // Les cotisations patronales et infos n'affectent ni brut ni base
  }

  brut = round2(brut);
  baseIts = round2(baseIts);
  baseCnps = round2(baseCnps);

  // ── 2. Cotisations sociales SALARIALES ───────────────────────────────────
  // CNPS retraite : 6,3 % sur brut plafonné à 2 700 000
  const baseRetraite = Math.min(baseCnps, PARAMS_CI.plafond_retraite);
  const cnpsRetraiteSal = round2(baseRetraite * PARAMS_CI.taux_cnps_retraite_sal / 100);
  lignes.push({
    code: 'CNPS_RETRAITE_SAL',
    libelle: `CNPS Retraite (${PARAMS_CI.taux_cnps_retraite_sal}%)`,
    type: 'cotisation_salariale',
    base: baseRetraite, taux: PARAMS_CI.taux_cnps_retraite_sal,
    montant: cnpsRetraiteSal, est_patronale: false, ordre: 200,
  });

  // CMU forfaitaire 1 000 FCFA — désormais à la charge PATRONALE par défaut
  // (pratique courante des conventions collectives ivoiriennes ; l'employeur
  // verse à la CNAM pour le compte du salarié). Côté salarié, seules les
  // 6,6 % CNPS sont déduites du brut.
  // Calculée plus bas dans le bloc « Cotisations patronales ».
  const totalCotisationsSalariales = round2(cnpsRetraiteSal);

  // ── 3. Salaire imposable ──────────────────────────────────────────────────
  // Salaire imposable = base ITS − CNPS salariale − abattement 20 % frais pro
  const baseApresCnps = baseIts - cnpsRetraiteSal;
  const abattementFrais = round2(baseApresCnps * PARAMS_CI.taux_abattement_frais / 100);
  const salaireImposable = round2(Math.max(0, baseApresCnps - abattementFrais));

  // ── 4. ITS (IRPP) avec quotient familial ──────────────────────────────────
  // Calcul : (Salaire imposable / parts) → barème → × parts
  const itsParPart = appliquerBareme(salaireImposable / nbParts, PARAMS_CI.baremes_its);
  const its = round2(itsParPart * nbParts);
  if (its > 0) {
    lignes.push({
      code: 'ITS', libelle: 'ITS (IRPP)',
      type: 'cotisation_salariale', base: salaireImposable, taux: null,
      montant: its, est_patronale: false, ordre: 220,
    });
  }

  // ── 5. Contribution Nationale (CN) ────────────────────────────────────────
  const cn = round2(appliquerBareme(salaireImposable, PARAMS_CI.baremes_cn));
  if (cn > 0) {
    lignes.push({
      code: 'CN', libelle: 'Contribution Nationale',
      type: 'cotisation_salariale', base: salaireImposable, taux: null,
      montant: cn, est_patronale: false, ordre: 230,
    });
  }

  const totalImpots = round2(its + cn);

  // ── 6. Net à payer ────────────────────────────────────────────────────────
  // Net = Brut − cotisations salariales (CNPS 6,6 %) − impôts − retenues (avances).
  // La CMU est désormais à la charge patronale (cf. CMU_PAT plus bas).
  const netAPayer = round2(brut - totalCotisationsSalariales - totalImpots - totalRetenues);

  // ── 7. Cotisations PATRONALES (charges employeur) ─────────────────────────
  const basePF = Math.min(baseCnps, PARAMS_CI.plafond_pf);
  const cnpsRetraitePat = round2(baseRetraite * PARAMS_CI.taux_cnps_retraite_pat / 100);
  const cnpsPF = round2(basePF * PARAMS_CI.taux_cnps_pf / 100);
  const cnpsAT = round2(basePF * tauxAT / 100);
  const fdfp = round2(brut * PARAMS_CI.taux_fdfp / 100);
  const taxeApprentissage = round2(brut * PARAMS_CI.taux_taxe_apprentissage / 100);
  const cmuPat = PARAMS_CI.cmu_forfait;   // 1 000 FCFA / mois / employé

  lignes.push(
    {
      code: 'CNPS_RETRAITE_PAT', libelle: `CNPS Retraite patronale (${PARAMS_CI.taux_cnps_retraite_pat}%)`,
      type: 'cotisation_patronale', base: baseRetraite, taux: PARAMS_CI.taux_cnps_retraite_pat,
      montant: cnpsRetraitePat, est_patronale: true, ordre: 300,
    },
    {
      code: 'CNPS_PF', libelle: `Prestations familiales (${PARAMS_CI.taux_cnps_pf}%)`,
      type: 'cotisation_patronale', base: basePF, taux: PARAMS_CI.taux_cnps_pf,
      montant: cnpsPF, est_patronale: true, ordre: 310,
    },
    {
      code: 'CNPS_AT', libelle: `Accident du travail (${tauxAT}%)`,
      type: 'cotisation_patronale', base: basePF, taux: tauxAT,
      montant: cnpsAT, est_patronale: true, ordre: 320,
    },
    {
      code: 'CMU_PAT', libelle: `CMU (forfait CNAM)`,
      type: 'cotisation_patronale', base: null, taux: null,
      montant: cmuPat, est_patronale: true, ordre: 325,
    },
    {
      code: 'FDFP', libelle: `FDFP — Formation (${PARAMS_CI.taux_fdfp}%)`,
      type: 'cotisation_patronale', base: brut, taux: PARAMS_CI.taux_fdfp,
      montant: fdfp, est_patronale: true, ordre: 330,
    },
    {
      code: 'TAXE_APPRENTISSAGE', libelle: `Taxe d'apprentissage (${PARAMS_CI.taux_taxe_apprentissage}%)`,
      type: 'cotisation_patronale', base: brut, taux: PARAMS_CI.taux_taxe_apprentissage,
      montant: taxeApprentissage, est_patronale: true, ordre: 340,
    },
  );

  const totalCotisationsPatronales = round2(
    cnpsRetraitePat + cnpsPF + cnpsAT + cmuPat + fdfp + taxeApprentissage
  );

  // Coût total employeur
  const coutTotalEmployeur = round2(brut + totalCotisationsPatronales);

  // Tri des lignes par ordre
  lignes.sort((a, b) => (a.ordre || 100) - (b.ordre || 100));

  return {
    nb_parts: nbParts,
    brut_total: brut,
    total_gains: round2(totalGains),
    total_cotisations_salariales: totalCotisationsSalariales,
    salaire_imposable: salaireImposable,
    abattement_frais_pro: abattementFrais,
    total_impots: totalImpots,
    its,
    cn,
    total_retenues: round2(totalRetenues),
    net_a_payer: netAPayer,
    total_cotisations_patronales: totalCotisationsPatronales,
    cout_total_employeur: coutTotalEmployeur,
    lignes,
  };
};

module.exports = {
  PARAMS_CI,
  calculerParts,
  calculerBulletin,
};
