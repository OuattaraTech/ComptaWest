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

// ═══════════════════════════════════════════════════════════════════════════
// calculateIvoryCoastPayroll — moteur ITS unique post-réforme 2024
// ═══════════════════════════════════════════════════════════════════════════
// Source officielle : Note DGI N° 00026/MFB/DGI/DLCD-SDL du 03 janvier 2024
// portant précisions sur l'ordonnance n° 2023-719 du 13 septembre 2023.
//
// La réforme 2024 a :
//   1. FUSIONNÉ les 3 anciens impôts cédulaires (IS + CN + IGR) en un
//      PRÉLÈVEMENT UNIQUE appelé « ITS » (Impôt sur Traitements et Salaires)
//      à barème progressif par tranches.
//   2. SUPPRIMÉ l'abattement forfaitaire de 20 % pour frais professionnels
//      (article 119 CGI modifié).
//   3. SUPPRIMÉ le mécanisme du quotient familial. Remplacé par une
//      RÉDUCTION FORFAITAIRE MENSUELLE déduite de l'impôt brut, fonction
//      uniquement du nombre de parts.
//   4. Fixé la CONTRIBUTION EMPLOYEUR à 2,8 % (personnel local) ou 12 %
//      (expatrié) sur le revenu brut imposable, sans abattement.
//
// La CNPS salariale reste à 6,6 % et est déductible de la base imposable
// (règle générale CGI inchangée par la réforme). Pour le mode STRICT
// document (base = brut SANS déduction CNPS), poser deduireCnpsDeBaseITS=false.

const TAUX_CNPS_SAL = 0.066;   // 5,5 % retraite générale + 1,1 % complémentaire

// Barème ITS mensuel — réforme 2024, 6 tranches progressives cumulatives
// (Note DGI, page 2, « Barème journalier d'imposition de la main d'œuvre
// occasionnelle » qui reprend les tranches mensuelles de l'ordonnance)
const BAREME_ITS_2024 = [
  { plafond:    75_000, taux: 0.00 },
  { plafond:   240_000, taux: 0.16 },
  { plafond:   800_000, taux: 0.21 },
  { plafond: 2_400_000, taux: 0.24 },
  { plafond: 8_000_000, taux: 0.28 },
  { plafond:  Infinity, taux: 0.32 },
];

// Réductions mensuelles d'impôt pour charges de famille (Note DGI page 2)
// Remplace le quotient familial. Indexées par le nombre de parts fiscales.
const REDUCTION_CHARGES_FAMILLE = {
  1.0:      0,
  1.5:  5_500,
  2.0: 11_000,
  2.5: 16_500,
  3.0: 22_000,
  3.5: 27_500,
  4.0: 33_000,
  4.5: 38_500,
  5.0: 44_000,
};

// Taux Contribution Employeur (Note DGI section IV, page 5)
const TAUX_CE_LOCAL    = 0.028;   // Personnel local
const TAUX_CE_EXPATRIE = 0.12;    // Personnel expatrié

// Calcul ITS brut par application du barème progressif cumulatif.
// Méthode standard : on remplit chaque tranche puis on passe à la suivante.
function appliquerBaremeITS2024(baseImposable) {
  let impot = 0;
  let plafondPrecedent = 0;
  for (const tranche of BAREME_ITS_2024) {
    if (baseImposable <= plafondPrecedent) break;
    const segment = Math.min(baseImposable, tranche.plafond) - plafondPrecedent;
    impot += segment * tranche.taux;
    plafondPrecedent = tranche.plafond;
  }
  return impot;
}

// Retourne la réduction forfaitaire pour le nombre de parts donné.
// Interpolation linéaire pour les parts intermédiaires (5,5 = 49 500…)
function reductionPourParts(nbParts) {
  const p = Math.max(1, parseFloat(nbParts) || 1);
  if (REDUCTION_CHARGES_FAMILLE[p] !== undefined) return REDUCTION_CHARGES_FAMILLE[p];
  // Au-delà de 5 parts, la réduction continue linéairement à +5 500 par 0,5 part
  if (p > 5) return 44_000 + Math.floor((p - 5) / 0.5) * 5_500;
  return 0;
}

/**
 * Applique un barème par tranches cumulatives.
 * Exemple pour CN avec base 336 240 :
 *   (50 000 × 0)  +  (80 000 × 1,5 %)  +  (70 000 × 5 %)
 *   + (336 240 - 200 000) × 10 %
 *   = 0 + 1 200 + 3 500 + 13 624 = 18 324
 */
function appliquerBaremeProgressif(base, bareme) {
  let impot = 0;
  let plafondPrecedent = 0;
  for (const tranche of bareme) {
    if (base <= plafondPrecedent) break;
    const segment = Math.min(base, tranche.plafond) - plafondPrecedent;
    impot += segment * tranche.taux;
    plafondPrecedent = tranche.plafond;
  }
  return impot;
}

/**
 * Calcul de paie Côte d'Ivoire selon le modèle IS + CN + IGR séparés.
 *
 * @param {object} input
 * @param {number} input.salaireDeBase       — Salaire brut de base mensuel
 * @param {number} [input.primesImposables]  — Sursalaire + ancienneté + rendement (toutes soumises à CNPS et ITS)
 * @param {number} [input.indemniteLogement] — Indemnité logement en espèces (soumise CNPS + ITS, CGI CI)
 * @param {number} [input.primeTransport]    — Prime transport (exonérée sous 30 000, surplus imposable)
 * @param {number} [input.partsFiscales]     — Nb parts fiscales (1 / 1,5 / 2 / 2,5 …) — sert UNIQUEMENT à la réduction forfaitaire
 * @param {boolean}[input.deduireCnpsDeBaseITS=true] — Si true (défaut), base ITS = brut - CNPS sal.
 *                                              Si false (lecture stricte note DGI), base ITS = brut directement.
 * @param {boolean}[input.expatrie=false]     — Si true, Contribution Employeur 12 % au lieu de 2,8 %
 *
 * @returns {{
 *   salaireBrutSocial: number,        // assiette CNPS + ITS
 *   cotisationsSalariales: number,    // CNPS salariale 6,6 %
 *   baseImposableITS: number,         // base de calcul de l'ITS
 *   itsBrut: number,                  // ITS avant réduction charges famille
 *   reductionChargesFamille: number,  // réduction forfaitaire selon parts
 *   itsNet: number,                   // ITS effectivement retenu = itsBrut - réduction
 *   impotsTotaux: number,             // = itsNet (un seul impôt depuis 2024)
 *   contributionEmployeur: number,    // 2,8 % local ou 12 % expatrié
 *   chargesPatronales: number,        // CNPS pat + CE + FDFP + apprentissage + CMU
 *   coutEmployeurTotal: number,       // brut versé + charges patronales
 *   netAPayer: number,                // versé au salarié
 *   detail: object,                   // exposé pour traçabilité du calcul
 * }}
 */
function calculateIvoryCoastPayroll({
  salaireDeBase = 0,
  primesImposables = 0,
  indemniteLogement = 0,
  primeTransport = 0,
  partsFiscales = 1,
  deduireCnpsDeBaseITS = true,
  expatrie = false,
}) {
  // ── 1. ASSIETTE BRUTE SOCIALE (CNPS) ─────────────────────────────────────
  // Surplus de prime transport (au-delà de 30 000 mensuels) réintégré dans
  // l'assiette imposable (CGI CI art. 116).
  const surplusTransport = Math.max(0, primeTransport - 30_000);
  const salaireBrutCNPS = salaireDeBase + primesImposables + indemniteLogement + surplusTransport;

  // CNPS salariale = 6,6 % SANS plafond (spec utilisateur 2026 + pratique courante)
  const cotisationsSalariales = salaireBrutCNPS * TAUX_CNPS_SAL;

  // ── 2. IMPÔT UNIQUE ITS (post-réforme 2024) ──────────────────────────────
  // Base imposable = brut, déduit éventuellement de la CNPS salariale
  // (pratique paie standard préservée par la réforme — la CNPS reste
  // déductible des revenus salariaux selon art. 116 CGI).
  // Pas d'abattement 20 % : SUPPRIMÉ par l'ordonnance 2023-719.
  const baseImposableITS = deduireCnpsDeBaseITS
    ? Math.max(0, salaireBrutCNPS - cotisationsSalariales)
    : salaireBrutCNPS;

  // Barème 6 tranches : 0/16/21/24/28/32 % (Note DGI page 2)
  const itsBrut = appliquerBaremeITS2024(baseImposableITS);

  // ── 3. RÉDUCTION FORFAITAIRE POUR CHARGES DE FAMILLE ─────────────────────
  // Remplace l'ancien quotient familial. Tableau officiel de la Note DGI.
  const parts = Math.max(1, parseFloat(partsFiscales) || 1);
  const reductionChargesFamille = reductionPourParts(parts);

  // L'ITS net ne peut pas être négatif (si réduction > ITS brut → 0)
  const itsNet = Math.max(0, itsBrut - reductionChargesFamille);
  const impotsTotaux = itsNet;

  // ── 4. CONTRIBUTION EMPLOYEUR (Note DGI section IV) ──────────────────────
  // 2,8 % local OU 12 % expatrié sur le brut imposable (sans abattement 20 %)
  const tauxCE = expatrie ? TAUX_CE_EXPATRIE : TAUX_CE_LOCAL;
  const contributionEmployeur = salaireBrutCNPS * tauxCE;

  // ── 5. AUTRES CHARGES PATRONALES (CNPS + FDFP + Apprentissage + CMU) ────
  // Reprises de PARAMS_CI pour cohérence avec les pratiques 2024
  const basePF = Math.min(salaireBrutCNPS, PARAMS_CI.plafond_pf);
  const cnpsRetraitePat   = salaireBrutCNPS * PARAMS_CI.taux_cnps_retraite_pat / 100;
  const cnpsPF            = basePF * PARAMS_CI.taux_cnps_pf / 100;
  const cnpsAT            = basePF * PARAMS_CI.taux_at_default / 100;
  const fdfp              = salaireBrutCNPS * PARAMS_CI.taux_fdfp / 100;
  const taxeApprentissage = salaireBrutCNPS * PARAMS_CI.taux_taxe_apprentissage / 100;
  const cmuPat            = PARAMS_CI.cmu_forfait;

  const chargesPatronales = contributionEmployeur + cnpsRetraitePat + cnpsPF
                           + cnpsAT + fdfp + taxeApprentissage + cmuPat;

  // ── 6. NET À PAYER + COÛT EMPLOYEUR ──────────────────────────────────────
  // Net = brut salarié (toutes primes, transport intégral) - CNPS sal - ITS net
  const brutVerse = salaireDeBase + primesImposables + indemniteLogement + primeTransport;
  const netAPayer = brutVerse - cotisationsSalariales - impotsTotaux;
  const coutEmployeurTotal = brutVerse + chargesPatronales;

  return {
    salaireBrutSocial: round0(salaireBrutCNPS),
    cotisationsSalariales: round0(cotisationsSalariales),
    baseImposableITS: round0(baseImposableITS),
    itsBrut: round0(itsBrut),
    reductionChargesFamille,
    itsNet: round0(itsNet),
    impotsTotaux: round0(impotsTotaux),
    contributionEmployeur: round0(contributionEmployeur),
    chargesPatronales: round0(chargesPatronales),
    coutEmployeurTotal: round0(coutEmployeurTotal),
    netAPayer: round0(netAPayer),
    // Champs rétro-compat (les contrôleurs et le PDF s'en servent encore)
    montantIS:  0,                            // legacy : impôts désormais unifiés dans itsNet
    montantCN:  0,
    montantIGR: round0(itsNet),               // alias pour rétrocompat affichage
    detail: {
      surplusTransportTaxable: round0(surplusTransport),
      baseImposableITS:        round0(baseImposableITS),
      itsBrut:                 round0(itsBrut),
      reductionChargesFamille,
      partsFiscales:           parts,
      tauxContributionEmployeur: tauxCE,
      regime: 'ITS_2024',
    },
  };
}

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
  const nbParts = calculerParts(employe);

  // ── 1. DÉCOMPOSITION des rubriques pour le moteur IS+CN+IGR ───────────────
  // Le nouveau moteur attend 4 entrées agrégées :
  //   - primesImposables   = somme des gains imposables (hors logement et transport)
  //   - indemniteLogement  = IND_LOGEMENT (codé séparément car règle DGI distincte)
  //   - primeTransport     = PRIME_TRANSPORT (plafond 30 000 géré dans le moteur)
  // Tout le reste (avantages en nature info, surplus exceptionnels) est
  // mappé sur primesImposables. Retenues séparées (avances, prêts).
  let primesImposables = 0;
  let indemniteLogement = 0;
  let primeTransport = 0;
  let totalRetenues = 0;
  let totalGains = 0;

  const lignes = [{
    code: 'SALAIRE_BASE', libelle: 'Salaire de base', type: 'gain',
    base: null, taux: null, montant: salaireBase,
    est_patronale: false, ordre: 10,
  }];

  for (const r of rubriques) {
    const montant = round2(r.montant);
    if (montant === 0) continue;
    lignes.push({
      code: r.code, libelle: r.libelle, type: r.type,
      base: r.base ?? null, taux: r.taux ?? null,
      montant, est_patronale: !!r.est_patronale, ordre: r.ordre ?? 100,
    });
    if (r.type === 'gain' || r.type === 'info') {
      totalGains += (r.type === 'gain' ? montant : 0);
      if (r.code === 'IND_LOGEMENT') {
        indemniteLogement += montant;
      } else if (r.code === 'PRIME_TRANSPORT') {
        primeTransport += montant;
      } else if (r.imposable_its !== false || r.type === 'info') {
        // Tout gain marqué imposable_its ≠ false va dans la base imposable
        primesImposables += montant;
      }
      // Les gains 100 % exonérés (imposable_its=false ET cotisable_cnps=false
      // hors transport) sont versés au salarié mais hors assiette — ils ne
      // sont pas comptés ici ; ajoutés directement au brut versé plus bas.
    } else if (r.type === 'retenue') {
      totalRetenues += montant;
    }
  }

  // ── 2. APPEL DU MOTEUR IS + CN + IGR ──────────────────────────────────────
  const calc = calculateIvoryCoastPayroll({
    salaireDeBase: salaireBase,
    primesImposables: round2(primesImposables),
    indemniteLogement: round2(indemniteLogement),
    primeTransport: round2(primeTransport),
    partsFiscales: nbParts,
  });

  // Brut total versé = salaire + TOUTES les primes (y compris transport
  // intégral et exonérations) — c'est le « brut versé » qui sert de base
  // au calcul du net à payer.
  const brut = round2(salaireBase + primesImposables + indemniteLogement + primeTransport);

  // ── 3. RECONSTITUTION DES LIGNES BULLETIN (compatibilité PDF + BDD) ──────
  // L'ancien moteur produisait 5 lignes cotisations (CNPS retraite, CMU,
  // ITS, CN puis patronales détaillées). Le nouveau moteur produit
  // CNPS sal + IS + CN + IGR côté salarié + charges patronales globales.
  // Lignes côté salarié — régime ITS unique 2024
  lignes.push({
    code: 'CNPS_SAL', libelle: 'CNPS salariale (6,6 %)',
    type: 'cotisation_salariale',
    base: calc.salaireBrutSocial, taux: 6.6,
    montant: calc.cotisationsSalariales, est_patronale: false, ordre: 200,
  });
  if (calc.itsBrut > 0) {
    lignes.push({
      code: 'ITS_BRUT', libelle: 'ITS brut (barème 6 tranches 0/16/21/24/28/32 %)',
      type: 'cotisation_salariale',
      base: calc.baseImposableITS, taux: null,
      montant: calc.itsBrut, est_patronale: false, ordre: 210,
    });
  }
  if (calc.reductionChargesFamille > 0) {
    lignes.push({
      code: 'REDUCTION_FAMILLE',
      libelle: `Réduction pour charges de famille (${calc.detail.partsFiscales} parts)`,
      type: 'cotisation_salariale',
      base: null, taux: null,
      montant: -calc.reductionChargesFamille,    // négatif = réduction
      est_patronale: false, ordre: 220,
    });
  }
  // Ligne ITS net = ce qui est effectivement retenu sur le bulletin
  if (calc.itsNet > 0) {
    lignes.push({
      code: 'ITS_NET', libelle: 'ITS net retenu',
      type: 'cotisation_salariale',
      base: null, taux: null,
      montant: calc.itsNet, est_patronale: false, ordre: 230,
    });
  }
  // Lignes côté patronal — ventilation détaillée (plus précis que 16,3 % flat)
  lignes.push({
    code: 'CONTRIB_EMPLOYEUR',
    libelle: `Contribution employeur (${(calc.detail.tauxContributionEmployeur * 100).toFixed(1)} %)`,
    type: 'cotisation_patronale',
    base: calc.salaireBrutSocial, taux: calc.detail.tauxContributionEmployeur * 100,
    montant: calc.contributionEmployeur, est_patronale: true, ordre: 300,
  });
  lignes.push({
    code: 'CHARGES_PATRONALES_AUTRES',
    libelle: 'CNPS pat. + FDFP + Apprentissage + CMU',
    type: 'cotisation_patronale',
    base: calc.salaireBrutSocial, taux: null,
    montant: calc.chargesPatronales - calc.contributionEmployeur,
    est_patronale: true, ordre: 310,
  });

  lignes.sort((a, b) => (a.ordre || 100) - (b.ordre || 100));

  // Recalcul du net avec retenues (le moteur n'en tient pas compte, c'est
  // au wrapper de les déduire pour ne pas casser la sémantique).
  const netAPayer = round2(calc.netAPayer - totalRetenues);

  return {
    nb_parts: nbParts,
    brut_total: brut,
    total_gains: round2(totalGains),
    total_cotisations_salariales: calc.cotisationsSalariales,
    salaire_imposable: calc.baseImposableITS,
    abattement_frais_pro: 0,           // SUPPRIMÉ par la réforme 2024
    total_impots: calc.impotsTotaux,
    // Réforme 2024 : un seul impôt ITS unique. Champs historiques
    // conservés pour rétrocompat affichage (its = IS+CN+IGR fusionnés)
    its: calc.itsNet,
    its_brut: calc.itsBrut,
    reduction_charges_famille: calc.reductionChargesFamille,
    cn: 0,
    igr: 0,
    total_retenues: round2(totalRetenues),
    net_a_payer: netAPayer,
    total_cotisations_patronales: calc.chargesPatronales,
    cout_total_employeur: round2(brut + calc.chargesPatronales),
    lignes,
  };
};

module.exports = {
  PARAMS_CI,
  calculerParts,
  calculerBulletin,
  // Moteur ITS unique réforme 2024 (Note DGI 00026 du 03 jan 2024)
  calculateIvoryCoastPayroll,
  appliquerBaremeProgressif,
  appliquerBaremeITS2024,
  reductionPourParts,
  BAREME_ITS_2024,
  REDUCTION_CHARGES_FAMILLE,
};
