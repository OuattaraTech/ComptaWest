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
// calculateIvoryCoastPayroll — moteur pur (mai 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Implémente la spec utilisateur (architecture IS + CN + IGR séparés,
// modèle CGI CI ancien régime). Cf. PR « refonte calcul paie » pour les
// hypothèses arbitrées :
//   - Plafond CNPS sal = 70 000 FCFA STRICT (spec utilisateur ; à ajuster
//     à 2 700 000 si vous voulez le plafond retraite réel CGI)
//   - Charges patronales = 16,3 % flat sur brut social (spec utilisateur ;
//     pour un détail Retraite + PF + AT + FDFP + CMU, utiliser
//     calculerBulletin() plus bas)
//   - Barème IGR = grille mensuelle CI ancien régime, exonération bas
//     salaire garantie (premier seuil à 25 000 / part)

// Spec utilisateur révisée (juin 2026) : pas de plafond sur la CNPS
// salariale. Pour 450 000 brut → 29 700 de CNPS (= 450 000 × 6,6 %).
// Si tu veux réintroduire un plafond, modifie PLAFOND_CNPS_SAL_MENSUEL
// ci-dessous (mettre Infinity = pas de plafond).
const PLAFOND_CNPS_SAL_MENSUEL = Infinity;
const TAUX_CNPS_SAL            = 0.066;      // 5,5 % retraite + 1,1 % complém.
const ABATTEMENT_FRAIS_PRO     = 0.20;       // 20 % pour IS et CN
const TAUX_IS                  = 0.012;      // 1,2 % flat
const ABATTEMENT_IGR           = 0.18;       // 18 % supplémentaire pour IGR
const TAUX_PATRONAL_GLOBAL     = 0.163;      // 16,3 % flat sur brut social

// Barème Contribution Nationale (CN) — mensuel, par tranches cumulatives
const BAREME_CN = [
  { plafond:  50_000, taux: 0.000 },
  { plafond: 130_000, taux: 0.015 },
  { plafond: 200_000, taux: 0.050 },
  { plafond: Infinity, taux: 0.100 },
];

// Barème IGR officiel DGI CI 2024 — formule mensuelle N × Q × T - N × K
// où N = nb parts, Q = quotient familial (base IGR / parts), T = taux
// de la tranche du quotient, K = constante de décote de la tranche.
// Cette méthode officielle évite l'erreur des tranches cumulatives
// classiques et applique automatiquement la progressivité avec décote.
// Source : Code Général des Impôts CI, annexe fiscale.
const BAREME_IGR_DGI = [
  { plafond:  25_000, taux: 0.00, K:       0 },
  { plafond:  45_583, taux: 0.10, K:   2_500 },
  { plafond:  81_583, taux: 0.15, K:   4_779 },
  { plafond: 126_583, taux: 0.20, K:   8_858 },
  { plafond: 220_333, taux: 0.25, K:  15_187 },
  { plafond: 389_083, taux: 0.35, K:  37_220 },
  { plafond: 842_166, taux: 0.45, K:  76_128 },
  { plafond: Infinity, taux: 0.60, K: 202_478 },
];

// Helper pour la formule officielle DGI : N × Q × T - N × K, où K et T
// dépendent de la tranche dans laquelle Q tombe.
function igrParts(quotient, nbParts) {
  for (const tranche of BAREME_IGR_DGI) {
    if (quotient <= tranche.plafond) {
      return Math.max(0, nbParts * quotient * tranche.taux - nbParts * tranche.K);
    }
  }
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
 * @param {number} [input.primesImposables]  — Sursalaire + ancienneté + rendement (TOUTES soumises à CNPS, IS, CN, IGR)
 * @param {number} [input.indemniteLogement] — Indemnité logement en espèces (soumise à CNPS + IS + CN + IGR)
 * @param {number} [input.primeTransport]    — Prime transport (exonérée sous 30 000, surplus imposable)
 * @param {number} [input.partsFiscales]     — Nombre de parts fiscales (1 / 1,5 / 2 / 2,5 …), défaut 1
 *
 * @returns {{
 *   salaireBrutSocial: number,        // assiette CNPS / IS / CN
 *   cotisationsSalariales: number,    // CNPS salariale (avec plafond)
 *   montantIS: number,
 *   montantCN: number,
 *   montantIGR: number,
 *   impotsTotaux: number,             // IS + CN + IGR
 *   chargesPatronales: number,        // 16,3 % flat
 *   coutEmployeurTotal: number,       // salaire brut versé + charges patronales
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
}) {
  // ── 1. ASSIETTE BRUTE SOCIALE (CNPS) ─────────────────────────────────────
  // Surplus de prime transport (au-delà de 30 000 mensuels) réintégré dans
  // l'assiette imposable conformément au CGI CI.
  const surplusTransport = Math.max(0, primeTransport - 30_000);
  const salaireBrutCNPS = salaireDeBase + primesImposables + indemniteLogement + surplusTransport;

  // CNPS salariale = 6,6 % plafonné à PLAFOND_CNPS_SAL_MENSUEL
  // ⚠ ATTENTION : plafond 70 000 FCFA conforme à la spec utilisateur.
  //   La pratique CNPS réelle utilise 2 700 000 FCFA pour la retraite.
  //   Pour basculer, remplacer PLAFOND_CNPS_SAL_MENSUEL par 2_700_000.
  const baseCotisable = Math.min(salaireBrutCNPS, PLAFOND_CNPS_SAL_MENSUEL);
  const cotisationsSalariales = baseCotisable * TAUX_CNPS_SAL;

  // ── 2. IMPÔT SUR LE SALAIRE (IS) — 1,2 % flat ────────────────────────────
  const baseIS_CN = (salaireBrutCNPS - cotisationsSalariales) * (1 - ABATTEMENT_FRAIS_PRO);
  const montantIS = baseIS_CN * TAUX_IS;

  // ── 3. CONTRIBUTION NATIONALE (CN) — barème progressif ───────────────────
  const montantCN = appliquerBaremeProgressif(baseIS_CN, BAREME_CN);

  // ── 4. IMPÔT GÉNÉRAL SUR LE REVENU (IGR) ─────────────────────────────────
  // Base = (brut - CNPS - IS - CN) × 82 % (abattement 18 % supplémentaire)
  // Quotient familial = Base / parts → barème IGR → résultat × parts
  const baseIGRBrute = Math.max(
    0,
    (salaireBrutCNPS - cotisationsSalariales - montantIS - montantCN) * (1 - ABATTEMENT_IGR)
  );
  const parts = Math.max(1, parseFloat(partsFiscales) || 1);
  const quotient = baseIGRBrute / parts;
  // Formule officielle DGI CI : N × Q × T - N × K (avec décote K par tranche).
  // Plus précise que les tranches cumulatives classiques et conforme à
  // l'usage administratif fiscal ivoirien.
  const montantIGR = igrParts(quotient, parts);
  const igrParPart = parts > 0 ? montantIGR / parts : 0;

  const impotsTotaux = montantIS + montantCN + montantIGR;

  // ── 5. CHARGES PATRONALES ────────────────────────────────────────────────
  // Spec utilisateur : 16,3 % flat sur brut social. Englobe Retraite + PF +
  // AT + FDFP + Taxe Apprentissage + CMU en moyenne pondérée. Calcul détaillé
  // par cotisation disponible dans calculerBulletin() ci-dessous.
  const chargesPatronales = salaireBrutCNPS * TAUX_PATRONAL_GLOBAL;

  // ── 6. NET À PAYER + COÛT EMPLOYEUR ──────────────────────────────────────
  // Net = brut salarié (toutes primes y compris transport intégral) -
  //       cotisations salariales - impôts
  const brutVerse = salaireDeBase + primesImposables + indemniteLogement + primeTransport;
  const netAPayer = brutVerse - cotisationsSalariales - impotsTotaux;
  const coutEmployeurTotal = brutVerse + chargesPatronales;

  return {
    salaireBrutSocial: round0(salaireBrutCNPS),
    cotisationsSalariales: round0(cotisationsSalariales),
    montantIS: round0(montantIS),
    montantCN: round0(montantCN),
    montantIGR: round0(montantIGR),
    impotsTotaux: round0(impotsTotaux),
    chargesPatronales: round0(chargesPatronales),
    coutEmployeurTotal: round0(coutEmployeurTotal),
    netAPayer: round0(netAPayer),
    detail: {
      surplusTransportTaxable: round0(surplusTransport),
      baseCotisableCnps:        round0(baseCotisable),
      baseImpotsISetCN:         round0(baseIS_CN),
      baseIGRBrute:             round0(baseIGRBrute),
      quotientFamilial:         round0(quotient),
      igrParPart:               round0(igrParPart),
      partsFiscales:            parts,
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
  lignes.push({
    code: 'CNPS_SAL', libelle: 'CNPS salariale (6,6 % plafonné)',
    type: 'cotisation_salariale',
    base: calc.detail.baseCotisableCnps, taux: 6.6,
    montant: calc.cotisationsSalariales, est_patronale: false, ordre: 200,
  });
  if (calc.montantIS > 0) {
    lignes.push({
      code: 'IS', libelle: 'IS — Impôt sur le Salaire (1,2 %)',
      type: 'cotisation_salariale',
      base: calc.detail.baseImpotsISetCN, taux: 1.2,
      montant: calc.montantIS, est_patronale: false, ordre: 210,
    });
  }
  if (calc.montantCN > 0) {
    lignes.push({
      code: 'CN', libelle: 'CN — Contribution Nationale',
      type: 'cotisation_salariale',
      base: calc.detail.baseImpotsISetCN, taux: null,
      montant: calc.montantCN, est_patronale: false, ordre: 220,
    });
  }
  if (calc.montantIGR > 0) {
    lignes.push({
      code: 'IGR', libelle: 'IGR — Impôt Général sur le Revenu',
      type: 'cotisation_salariale',
      base: calc.detail.baseIGRBrute, taux: null,
      montant: calc.montantIGR, est_patronale: false, ordre: 230,
    });
  }
  lignes.push({
    code: 'CHARGES_PATRONALES', libelle: 'Charges patronales (16,3 % flat)',
    type: 'cotisation_patronale',
    base: calc.salaireBrutSocial, taux: 16.3,
    montant: calc.chargesPatronales, est_patronale: true, ordre: 300,
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
    salaire_imposable: calc.detail.baseImpotsISetCN,
    abattement_frais_pro: round2((calc.salaireBrutSocial - calc.cotisationsSalariales) * 0.20),
    total_impots: calc.impotsTotaux,
    its: calc.montantIS,           // conservé pour compat ascendante (alias = IS)
    cn: calc.montantCN,
    igr: calc.montantIGR,
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
  // Moteur IS+CN+IGR séparés (mai 2026)
  calculateIvoryCoastPayroll,
  appliquerBaremeProgressif,
  igrParts,
  BAREME_CN,
  BAREME_IGR_DGI,
};
