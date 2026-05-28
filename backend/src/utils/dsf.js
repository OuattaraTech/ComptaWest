/**
 * Génération des liasses fiscales DSF (Déclaration Statistique et Fiscale)
 * au format SYSCOHADA révisé OHADA.
 *
 * V1 (Lot DSF-1) : Bilan ACTIF, Bilan PASSIF, Compte de Résultat.
 * V2 plus tard : TAFIRE, annexes, export e-DGI.
 *
 * Méthode :
 *   1. Lit la balance des comptes (sum debit/credit par compte_numero)
 *      pour l'exercice donné, depuis lignes_ecriture des écritures validées.
 *   2. Pour chaque poste DSF (code à 2 lettres ex: 'TA','AZ','XI'), calcule
 *      la valeur en agrégeant les comptes du mappage avec le sens (D/C) et
 *      la classe d'opération (brut/amort/net).
 *   3. Retourne 3 structures normalisées prêtes à l'affichage et au PDF.
 *
 * Mappage non exhaustif (postes principaux) — suffit à 95% des PME RNI/RSI.
 * Les comptes spécifiques rares (titres de participation, écarts de
 * conversion, hors activité ordinaire complexes) sont agrégés dans
 * « Autres » ou laissés à zéro — précis assez pour la 1ère version.
 */
const pool = require('../../config/database');

// Charge la balance comptable d'un exercice : pour chaque numéro de compte,
// la somme des débits et crédits des écritures VALIDÉES de l'exercice.
async function chargerBalance(entrepriseId, exerciceId) {
  const r = await pool.query(`
    SELECT le.compte_numero AS num,
           COALESCE(SUM(le.debit), 0)  AS debit,
           COALESCE(SUM(le.credit), 0) AS credit
      FROM lignes_ecriture le
      JOIN ecritures e ON e.id = le.ecriture_id
     WHERE e.entreprise_id = $1
       AND e.exercice_id = $2
       AND e.validee = true
     GROUP BY le.compte_numero
     ORDER BY le.compte_numero
  `, [entrepriseId, exerciceId]);
  const map = new Map();
  for (const row of r.rows) {
    map.set(row.num, {
      debit: parseFloat(row.debit) || 0,
      credit: parseFloat(row.credit) || 0,
      solde_debiteur: Math.max(0, parseFloat(row.debit) - parseFloat(row.credit)),
      solde_crediteur: Math.max(0, parseFloat(row.credit) - parseFloat(row.debit)),
    });
  }
  return map;
}

// Helpers d'agrégation
// somme(balance, ['401','408']) → somme des soldes créditeurs de ces comptes
// Préfixe accepté ('40' = tous les 40*)
function sommeSolde(balance, prefixes, sens /* 'D' ou 'C' */) {
  let total = 0;
  for (const [num, sol] of balance) {
    if (prefixes.some(p => num.startsWith(p))) {
      total += sens === 'D' ? sol.solde_debiteur : sol.solde_crediteur;
    }
  }
  return total;
}
// Somme algébrique (utile pour les comptes 6/7 où l'on veut le mvt net)
function sommeMouvement(balance, prefixes, sens) {
  let total = 0;
  for (const [num, sol] of balance) {
    if (prefixes.some(p => num.startsWith(p))) {
      total += sens === 'D' ? sol.debit - sol.credit : sol.credit - sol.debit;
    }
  }
  return total;
}

/**
 * COMPTE DE RÉSULTAT — Form N°4 SYSCOHADA révisé
 * Structure en cascade : marge → CA → VA → EBE → REX → RAO → RHAO → RNet
 */
function calculerCompteResultat(balance) {
  // Ventes de marchandises (701) et achats associés (601, 6031)
  const ventesMarchandises = sommeMouvement(balance, ['701'], 'C');
  const achatsMarchandises = sommeMouvement(balance, ['601'], 'D');
  const varStockMarch      = sommeMouvement(balance, ['6031'], 'D'); // peut être négative

  const margeCommerciale = ventesMarchandises - achatsMarchandises - varStockMarch;

  // Production
  const ventesProduits     = sommeMouvement(balance, ['702','703','704'], 'C');
  const travauxServices    = sommeMouvement(balance, ['705','706'], 'C');
  const productsAccessoires = sommeMouvement(balance, ['707','708'], 'C');
  const productionStockee  = sommeMouvement(balance, ['73'], 'C');
  const productionImmo     = sommeMouvement(balance, ['72'], 'C');

  const chiffreAffaires = ventesMarchandises + ventesProduits + travauxServices + productsAccessoires;

  // Autres produits exploitation
  const subventionsExpl    = sommeMouvement(balance, ['71'], 'C');
  const autresProduits     = sommeMouvement(balance, ['75'], 'C');
  const transfertsCharges  = sommeMouvement(balance, ['781'], 'C');

  // Consommations
  const achatsMatieres     = sommeMouvement(balance, ['602'], 'D');
  const varStockMatieres   = sommeMouvement(balance, ['6032','6033'], 'D');
  const autresAchats       = sommeMouvement(balance, ['604','605','608'], 'D');
  const varStockAutres     = sommeMouvement(balance, ['6034'], 'D');
  const transports         = sommeMouvement(balance, ['61'], 'D');
  const servicesExterieurs = sommeMouvement(balance, ['62','63'], 'D');
  const impotsTaxes        = sommeMouvement(balance, ['64'], 'D');
  const autresCharges      = sommeMouvement(balance, ['65'], 'D');

  const valeurAjoutee = margeCommerciale
                      + ventesProduits + travauxServices + productsAccessoires
                      + productionStockee + productionImmo
                      + subventionsExpl + autresProduits + transfertsCharges
                      - achatsMatieres - varStockMatieres
                      - autresAchats - varStockAutres
                      - transports - servicesExterieurs
                      - impotsTaxes - autresCharges;

  // Charges de personnel
  const chargesPersonnel = sommeMouvement(balance, ['66'], 'D');

  const ebe = valeurAjoutee - chargesPersonnel;

  // Amortissements et provisions exploitation
  const reprisesAmort    = sommeMouvement(balance, ['791','798'], 'C');
  const dotationsAmort   = sommeMouvement(balance, ['681','691'], 'D');

  const resultatExploitation = ebe + reprisesAmort - dotationsAmort;

  // Résultat financier
  const revenusFinanciers   = sommeMouvement(balance, ['77'], 'C');
  const reprisesFinancieres = sommeMouvement(balance, ['797'], 'C');
  const fraisFinanciers     = sommeMouvement(balance, ['67'], 'D');
  const dotationsFinanciere = sommeMouvement(balance, ['687','697'], 'D');

  const resultatFinancier = revenusFinanciers + reprisesFinancieres
                          - fraisFinanciers - dotationsFinanciere;

  const resultatActivitesOrdinaires = resultatExploitation + resultatFinancier;

  // HAO (Hors Activités Ordinaires)
  const produitsHAO = sommeMouvement(balance, ['82','84','86','88'], 'C');
  const chargesHAO  = sommeMouvement(balance, ['81','83','85','87'], 'D');

  const resultatHAO = produitsHAO - chargesHAO;

  // Participation + IS
  const participation     = sommeMouvement(balance, ['87'], 'D'); // travailleurs
  const impotsResultat    = sommeMouvement(balance, ['891','895'], 'D');

  const resultatNet = resultatActivitesOrdinaires + resultatHAO - participation - impotsResultat;

  return {
    titre: 'COMPTE DE RÉSULTAT — Modèle SYSCOHADA révisé',
    lignes: [
      { ref: 'TA', libelle: 'Ventes de marchandises', valeur: ventesMarchandises, niveau: 1 },
      { ref: 'RA', libelle: '(-) Achats de marchandises', valeur: achatsMarchandises, niveau: 1, soustrait: true },
      { ref: 'RB', libelle: 'Variation de stocks de marchandises', valeur: varStockMarch, niveau: 1, soustrait: true },
      { ref: 'XA', libelle: 'MARGE COMMERCIALE', valeur: margeCommerciale, niveau: 0, total: true },
      { ref: 'TB', libelle: 'Ventes de produits fabriqués', valeur: ventesProduits, niveau: 1 },
      { ref: 'TC', libelle: 'Travaux, services vendus', valeur: travauxServices, niveau: 1 },
      { ref: 'TD', libelle: 'Produits accessoires', valeur: productsAccessoires, niveau: 1 },
      { ref: 'XB', libelle: 'CHIFFRE D\'AFFAIRES', valeur: chiffreAffaires, niveau: 0, total: true, surligne: true },
      { ref: 'TE', libelle: 'Production stockée (ou déstockage)', valeur: productionStockee, niveau: 1 },
      { ref: 'TF', libelle: 'Production immobilisée', valeur: productionImmo, niveau: 1 },
      { ref: 'TG', libelle: 'Subventions d\'exploitation', valeur: subventionsExpl, niveau: 1 },
      { ref: 'TH', libelle: 'Autres produits', valeur: autresProduits, niveau: 1 },
      { ref: 'TI', libelle: 'Transferts de charges d\'exploitation', valeur: transfertsCharges, niveau: 1 },
      { ref: 'RC', libelle: '(-) Achats de matières premières', valeur: achatsMatieres, niveau: 1, soustrait: true },
      { ref: 'RD', libelle: 'Variation de stocks matières', valeur: varStockMatieres, niveau: 1, soustrait: true },
      { ref: 'RE', libelle: '(-) Autres achats', valeur: autresAchats, niveau: 1, soustrait: true },
      { ref: 'RF', libelle: 'Variation autres stocks', valeur: varStockAutres, niveau: 1, soustrait: true },
      { ref: 'RG', libelle: '(-) Transports', valeur: transports, niveau: 1, soustrait: true },
      { ref: 'RH', libelle: '(-) Services extérieurs', valeur: servicesExterieurs, niveau: 1, soustrait: true },
      { ref: 'RI', libelle: '(-) Impôts et taxes', valeur: impotsTaxes, niveau: 1, soustrait: true },
      { ref: 'RJ', libelle: '(-) Autres charges', valeur: autresCharges, niveau: 1, soustrait: true },
      { ref: 'XC', libelle: 'VALEUR AJOUTÉE', valeur: valeurAjoutee, niveau: 0, total: true },
      { ref: 'RK', libelle: '(-) Charges de personnel', valeur: chargesPersonnel, niveau: 1, soustrait: true },
      { ref: 'XD', libelle: 'EXCÉDENT BRUT D\'EXPLOITATION', valeur: ebe, niveau: 0, total: true },
      { ref: 'TJ', libelle: 'Reprises d\'amortissements et provisions', valeur: reprisesAmort, niveau: 1 },
      { ref: 'RL', libelle: '(-) Dotations aux amortissements et provisions', valeur: dotationsAmort, niveau: 1, soustrait: true },
      { ref: 'XE', libelle: 'RÉSULTAT D\'EXPLOITATION', valeur: resultatExploitation, niveau: 0, total: true, surligne: true },
      { ref: 'TK', libelle: 'Revenus financiers et assimilés', valeur: revenusFinanciers, niveau: 1 },
      { ref: 'TL', libelle: 'Reprises financières', valeur: reprisesFinancieres, niveau: 1 },
      { ref: 'RM', libelle: '(-) Frais financiers', valeur: fraisFinanciers, niveau: 1, soustrait: true },
      { ref: 'RN', libelle: '(-) Dotations financières', valeur: dotationsFinanciere, niveau: 1, soustrait: true },
      { ref: 'XF', libelle: 'RÉSULTAT FINANCIER', valeur: resultatFinancier, niveau: 0, total: true },
      { ref: 'XG', libelle: 'RÉSULTAT DES ACTIVITÉS ORDINAIRES', valeur: resultatActivitesOrdinaires, niveau: 0, total: true, surligne: true },
      { ref: 'TM', libelle: 'Produits hors activités ordinaires (HAO)', valeur: produitsHAO, niveau: 1 },
      { ref: 'RO', libelle: '(-) Charges hors activités ordinaires', valeur: chargesHAO, niveau: 1, soustrait: true },
      { ref: 'XH', libelle: 'RÉSULTAT HAO', valeur: resultatHAO, niveau: 0, total: true },
      { ref: 'RP', libelle: '(-) Participation des travailleurs', valeur: participation, niveau: 1, soustrait: true },
      { ref: 'RQ', libelle: '(-) Impôts sur le résultat', valeur: impotsResultat, niveau: 1, soustrait: true },
      { ref: 'XI', libelle: 'RÉSULTAT NET DE L\'EXERCICE', valeur: resultatNet, niveau: 0, total: true, surligne: true, final: true },
    ],
    indicateurs: {
      chiffre_affaires: chiffreAffaires,
      marge_commerciale: margeCommerciale,
      valeur_ajoutee: valeurAjoutee,
      ebe,
      resultat_exploitation: resultatExploitation,
      resultat_financier: resultatFinancier,
      resultat_net: resultatNet,
    },
  };
}

/**
 * BILAN ACTIF — Form N°10 SYSCOHADA révisé
 * Brut / Amortissement / Net pour les immobilisations.
 */
function calculerBilanActif(balance) {
  // Immobilisations incorporelles (20, 21 brut ; 280, 281 amort)
  const incorpBrut    = sommeSolde(balance, ['21'], 'D');
  const incorpAmort   = sommeSolde(balance, ['28','29'].map(p => p + '1').concat(['281','291']), 'C');
  const incorpNet     = incorpBrut - incorpAmort;

  // Immobilisations corporelles (22-24 brut, 282-284 amort)
  const corpBrut      = sommeSolde(balance, ['22','23','24'], 'D');
  const corpAmort     = sommeSolde(balance, ['282','283','284','292','293','294'], 'C');
  const corpNet       = corpBrut - corpAmort;

  // Avances et acomptes versés sur immo
  const avancesImmo   = sommeSolde(balance, ['252'], 'D');

  // Immobilisations financières (26, 27 brut ; 296, 297 prov)
  const financBrut    = sommeSolde(balance, ['26','27'], 'D');
  const financProv    = sommeSolde(balance, ['296','297'], 'C');
  const financNet     = financBrut - financProv;

  const totalActifImmoBrut  = incorpBrut + corpBrut + avancesImmo + financBrut;
  const totalActifImmoAmort = incorpAmort + corpAmort + financProv;
  const totalActifImmoNet   = totalActifImmoBrut - totalActifImmoAmort;

  // Actif circulant HAO
  const circulantHAOBrut  = sommeSolde(balance, ['485'], 'D');
  const circulantHAOProv  = sommeSolde(balance, ['490'], 'C');

  // Stocks (31-38 brut, 39 prov)
  const stocksBrut    = sommeSolde(balance, ['31','32','33','34','35','36','37','38'], 'D');
  const stocksProv    = sommeSolde(balance, ['39'], 'C');
  const stocksNet     = stocksBrut - stocksProv;

  // Créances clients
  const clientsBrut   = sommeSolde(balance, ['41'], 'D');
  const clientsProv   = sommeSolde(balance, ['491','492'], 'C');
  const clientsNet    = clientsBrut - clientsProv;

  // Fournisseurs avances versées
  const fournisAvances = sommeSolde(balance, ['409'], 'D');

  // Autres créances
  const autresCreancesBrut = sommeSolde(balance, ['42','43','44','45','46','47','48'], 'D');
  const autresCreancesProv = sommeSolde(balance, ['493','494','495','496','497','498'], 'C');
  const autresCreancesNet  = autresCreancesBrut - autresCreancesProv;

  const totalCirculantBrut  = circulantHAOBrut + stocksBrut + clientsBrut + fournisAvances + autresCreancesBrut;
  const totalCirculantAmort = circulantHAOProv + stocksProv + clientsProv + autresCreancesProv;
  const totalCirculantNet   = totalCirculantBrut - totalCirculantAmort;

  // Trésorerie actif
  const titresPlace   = sommeSolde(balance, ['50'], 'D');
  const valeursEnc    = sommeSolde(balance, ['51'], 'D');
  const banquesCaisse = sommeSolde(balance, ['52','53','54','55','57'], 'D');
  const tresorerieActif = titresPlace + valeursEnc + banquesCaisse;

  // Écart de conversion
  const ecartConvActif = sommeSolde(balance, ['478'], 'D');

  const totalGeneralBrut  = totalActifImmoBrut + totalCirculantBrut + tresorerieActif + ecartConvActif;
  const totalGeneralAmort = totalActifImmoAmort + totalCirculantAmort;
  const totalGeneralNet   = totalGeneralBrut - totalGeneralAmort;

  return {
    titre: 'BILAN — ACTIF — Modèle SYSCOHADA révisé',
    colonnes: ['Brut', 'Amort./Prov.', 'Net'],
    lignes: [
      { ref: 'AD', libelle: 'Immobilisations incorporelles', brut: incorpBrut, amort: incorpAmort, net: incorpNet },
      { ref: 'AI', libelle: 'Immobilisations corporelles', brut: corpBrut, amort: corpAmort, net: corpNet },
      { ref: 'AN', libelle: 'Avances et acomptes versés sur immo', brut: avancesImmo, amort: 0, net: avancesImmo },
      { ref: 'AP', libelle: 'Immobilisations financières', brut: financBrut, amort: financProv, net: financNet },
      { ref: 'AZ', libelle: 'TOTAL ACTIF IMMOBILISÉ', brut: totalActifImmoBrut, amort: totalActifImmoAmort, net: totalActifImmoNet, total: true },
      { ref: 'BA', libelle: 'Actif circulant HAO', brut: circulantHAOBrut, amort: circulantHAOProv, net: circulantHAOBrut - circulantHAOProv },
      { ref: 'BB', libelle: 'Stocks et en-cours', brut: stocksBrut, amort: stocksProv, net: stocksNet },
      { ref: 'BH', libelle: 'Fournisseurs avances versées', brut: fournisAvances, amort: 0, net: fournisAvances },
      { ref: 'BI', libelle: 'Clients', brut: clientsBrut, amort: clientsProv, net: clientsNet },
      { ref: 'BJ', libelle: 'Autres créances', brut: autresCreancesBrut, amort: autresCreancesProv, net: autresCreancesNet },
      { ref: 'BK', libelle: 'TOTAL ACTIF CIRCULANT', brut: totalCirculantBrut, amort: totalCirculantAmort, net: totalCirculantNet, total: true },
      { ref: 'BQ', libelle: 'Titres de placement', brut: titresPlace, amort: 0, net: titresPlace },
      { ref: 'BR', libelle: 'Valeurs à encaisser', brut: valeursEnc, amort: 0, net: valeursEnc },
      { ref: 'BS', libelle: 'Banques, chèques postaux, caisse', brut: banquesCaisse, amort: 0, net: banquesCaisse },
      { ref: 'BT', libelle: 'TOTAL TRÉSORERIE-ACTIF', brut: tresorerieActif, amort: 0, net: tresorerieActif, total: true },
      { ref: 'BU', libelle: 'Écarts de conversion-Actif', brut: ecartConvActif, amort: 0, net: ecartConvActif },
      { ref: 'BZ', libelle: 'TOTAL GÉNÉRAL', brut: totalGeneralBrut, amort: totalGeneralAmort, net: totalGeneralNet, total: true, surligne: true, final: true },
    ],
    total_net: totalGeneralNet,
  };
}

/**
 * BILAN PASSIF — Form N°11 SYSCOHADA révisé
 */
function calculerBilanPassif(balance, resultatNet) {
  // Capitaux propres
  const capital            = sommeSolde(balance, ['101','102','103','104'], 'C');
  const capitalNonAppele   = sommeSolde(balance, ['109'], 'D'); // débiteur = à soustraire
  const primesReserves     = sommeSolde(balance, ['105','106'], 'C');
  const ecartsReeval       = sommeSolde(balance, ['107'], 'C');
  const reportANouveau     = sommeSolde(balance, ['11'], 'C') - sommeSolde(balance, ['11'], 'D');
  const resultatBilan      = resultatNet;
  const subventionsInvest  = sommeSolde(balance, ['14'], 'C');
  const provReglementees   = sommeSolde(balance, ['15'], 'C');

  const totalCapPropres = capital - capitalNonAppele + primesReserves + ecartsReeval
                        + reportANouveau + resultatBilan + subventionsInvest + provReglementees;

  // Dettes financières
  const emprunts           = sommeSolde(balance, ['16'], 'C');
  const dettesLocAcquis    = sommeSolde(balance, ['17'], 'C');
  const provFinancieres    = sommeSolde(balance, ['19'], 'C');

  const totalDettesFinanc = emprunts + dettesLocAcquis + provFinancieres;

  const totalRessourcesStables = totalCapPropres + totalDettesFinanc;

  // Passif circulant
  const dettesHAO          = sommeSolde(balance, ['481','482','484'], 'C');
  const clientsAvancesRecu = sommeSolde(balance, ['419'], 'C');
  const fournisExploit     = sommeSolde(balance, ['40'], 'C') - sommeSolde(balance, ['409'], 'D');
  const dettesFiscales     = sommeSolde(balance, ['44'], 'C');
  const dettesSociales     = sommeSolde(balance, ['42','43'], 'C');
  const autresDettes       = sommeSolde(balance, ['45','46','47'], 'C') - sommeSolde(balance, ['478'], 'D');
  const risquesProvision   = sommeSolde(balance, ['499'], 'C');

  const totalPassifCirculant = dettesHAO + clientsAvancesRecu + fournisExploit
                             + dettesFiscales + dettesSociales + autresDettes + risquesProvision;

  // Trésorerie passif
  const banquesEscompte  = sommeSolde(balance, ['564'], 'C');
  const banquesTreso     = sommeSolde(balance, ['565'], 'C');
  const banquesDecouvert = sommeSolde(balance, ['561','562','563'], 'C');

  const totalTresoreriePassif = banquesEscompte + banquesTreso + banquesDecouvert;

  const ecartConvPassif = sommeSolde(balance, ['479'], 'C');

  const totalGeneral = totalRessourcesStables + totalPassifCirculant + totalTresoreriePassif + ecartConvPassif;

  return {
    titre: 'BILAN — PASSIF — Modèle SYSCOHADA révisé',
    lignes: [
      { ref: 'CA', libelle: 'Capital', valeur: capital, niveau: 1 },
      { ref: 'CB', libelle: '(-) Apporteurs, capital non appelé', valeur: capitalNonAppele, niveau: 1, soustrait: true },
      { ref: 'CD', libelle: 'Primes et réserves', valeur: primesReserves, niveau: 1 },
      { ref: 'CF', libelle: 'Écarts de réévaluation', valeur: ecartsReeval, niveau: 1 },
      { ref: 'CJ', libelle: 'Report à nouveau', valeur: reportANouveau, niveau: 1 },
      { ref: 'CL', libelle: 'Résultat net de l\'exercice', valeur: resultatBilan, niveau: 1 },
      { ref: 'CM', libelle: 'Subventions d\'investissement', valeur: subventionsInvest, niveau: 1 },
      { ref: 'CP', libelle: 'Provisions réglementées et fonds assimilés', valeur: provReglementees, niveau: 1 },
      { ref: 'CQ', libelle: 'TOTAL CAPITAUX PROPRES', valeur: totalCapPropres, niveau: 0, total: true, surligne: true },
      { ref: 'DB', libelle: 'Emprunts et dettes financières diverses', valeur: emprunts, niveau: 1 },
      { ref: 'DC', libelle: 'Dettes de location-acquisition', valeur: dettesLocAcquis, niveau: 1 },
      { ref: 'DD', libelle: 'Provisions financières pour risques et charges', valeur: provFinancieres, niveau: 1 },
      { ref: 'DE', libelle: 'TOTAL DETTES FINANCIÈRES', valeur: totalDettesFinanc, niveau: 0, total: true },
      { ref: 'DF', libelle: 'TOTAL RESSOURCES STABLES', valeur: totalRessourcesStables, niveau: 0, total: true, surligne: true },
      { ref: 'DH', libelle: 'Dettes circulantes HAO', valeur: dettesHAO, niveau: 1 },
      { ref: 'DI', libelle: 'Clients, avances reçues', valeur: clientsAvancesRecu, niveau: 1 },
      { ref: 'DJ', libelle: 'Fournisseurs d\'exploitation', valeur: fournisExploit, niveau: 1 },
      { ref: 'DK', libelle: 'Dettes fiscales', valeur: dettesFiscales, niveau: 1 },
      { ref: 'DL', libelle: 'Dettes sociales', valeur: dettesSociales, niveau: 1 },
      { ref: 'DM', libelle: 'Autres dettes', valeur: autresDettes, niveau: 1 },
      { ref: 'DN', libelle: 'Risques provisionnés à court terme', valeur: risquesProvision, niveau: 1 },
      { ref: 'DP', libelle: 'TOTAL PASSIF CIRCULANT', valeur: totalPassifCirculant, niveau: 0, total: true },
      { ref: 'DQ', libelle: 'Banques, crédits d\'escompte', valeur: banquesEscompte, niveau: 1 },
      { ref: 'DR', libelle: 'Banques, crédits de trésorerie', valeur: banquesTreso, niveau: 1 },
      { ref: 'DS', libelle: 'Banques, découverts', valeur: banquesDecouvert, niveau: 1 },
      { ref: 'DT', libelle: 'TOTAL TRÉSORERIE-PASSIF', valeur: totalTresoreriePassif, niveau: 0, total: true },
      { ref: 'DU', libelle: 'Écarts de conversion-Passif', valeur: ecartConvPassif, niveau: 1 },
      { ref: 'DZ', libelle: 'TOTAL GÉNÉRAL', valeur: totalGeneral, niveau: 0, total: true, surligne: true, final: true },
    ],
    total: totalGeneral,
  };
}

/**
 * TAFIRE — Tableau Financier des Ressources et Emplois (Form N°6)
 *
 * Montre comment l'entreprise a financé ses besoins durant l'exercice.
 * Structure SYSCOHADA :
 *   I.  CAFG (Capacité d'Autofinancement Globale) — depuis le compte de résultat
 *   II. Autofinancement = CAFG - dividendes distribués
 *   III. Emplois économiques (investissements + variations BFE/BFHAO)
 *   IV. Ressources nettes (capital, emprunts, cessions, subventions)
 *   V.  Variation de trésorerie (équilibre Ressources - Emplois)
 *
 * Nécessite la balance de N-1 pour calculer les variations. Si absente,
 * on retourne uniquement la CAFG avec un avertissement.
 */
function calculerTafire(balanceN, balanceNMoinsUn, cr) {
  // ─── I. CAFG (méthode soustractive depuis l'EBE) ─────────────────────────
  // CAFG = EBE + transferts charges + produits financ. + produits HAO encaissables
  //        - frais financ. - charges HAO décaissables - participation - IS
  const ebe = cr.indicateurs.ebe;
  const transfertsExpl = sommeMouvement(balanceN, ['781'], 'C');
  const revenusFinanc  = sommeMouvement(balanceN, ['77'], 'C');
  const transfertsHAO  = sommeMouvement(balanceN, ['848'], 'C'); // Transferts HAO
  const produitsHAOEnc = sommeMouvement(balanceN, ['82','84'], 'C'); // hors plus-value cession
  const fraisFinanc    = sommeMouvement(balanceN, ['67'], 'D');
  const chargesHAODec  = sommeMouvement(balanceN, ['83'], 'D'); // hors valeur comptable cessions
  const participation  = sommeMouvement(balanceN, ['87'], 'D');
  const impotsResult   = sommeMouvement(balanceN, ['891','895'], 'D');

  const cafg = ebe + transfertsExpl + revenusFinanc + transfertsHAO + produitsHAOEnc
             - fraisFinanc - chargesHAODec - participation - impotsResult;

  // ─── II. Autofinancement ─────────────────────────────────────────────────
  // Dividendes distribués pendant l'exercice (mouvement créditeur 11 / 465)
  const dividendes = sommeMouvement(balanceN, ['465'], 'D');
  const autofinancement = cafg - dividendes;

  // Sans balance N-1, on ne peut pas calculer les variations
  if (!balanceNMoinsUn) {
    return {
      titre: 'TAFIRE — Tableau Financier des Ressources et Emplois',
      avertissement: 'Exercice précédent introuvable — variations non calculables. Seule la CAFG est affichée.',
      lignes: [
        { ref: 'AA', libelle: 'EBE', valeur: ebe, niveau: 1 },
        { ref: 'AB', libelle: '+ Transferts de charges d\'exploitation', valeur: transfertsExpl, niveau: 1 },
        { ref: 'AC', libelle: '+ Revenus financiers et assimilés', valeur: revenusFinanc, niveau: 1 },
        { ref: 'AD', libelle: '+ Produits HAO encaissables', valeur: produitsHAOEnc + transfertsHAO, niveau: 1 },
        { ref: 'AE', libelle: '- Frais financiers', valeur: fraisFinanc, niveau: 1, soustrait: true },
        { ref: 'AF', libelle: '- Charges HAO décaissables', valeur: chargesHAODec, niveau: 1, soustrait: true },
        { ref: 'AG', libelle: '- Participation des travailleurs', valeur: participation, niveau: 1, soustrait: true },
        { ref: 'AH', libelle: '- Impôts sur le résultat', valeur: impotsResult, niveau: 1, soustrait: true },
        { ref: 'AI', libelle: 'CAFG', valeur: cafg, niveau: 0, total: true, surligne: true },
        { ref: 'AJ', libelle: '- Distributions de dividendes', valeur: dividendes, niveau: 1, soustrait: true },
        { ref: 'AK', libelle: 'AUTOFINANCEMENT', valeur: autofinancement, niveau: 0, total: true, surligne: true, final: true },
      ],
      cafg, autofinancement,
      partiel: true, // indique au front qu'on est en mode dégradé
    };
  }

  // ─── III. Emplois économiques ────────────────────────────────────────────
  // Investissements = variation des immobilisations brutes
  const immoIncorpN  = sommeSolde(balanceN, ['21'], 'D');
  const immoIncorpNM = sommeSolde(balanceNMoinsUn, ['21'], 'D');
  const dImmoIncorp  = immoIncorpN - immoIncorpNM;

  const immoCorpN  = sommeSolde(balanceN, ['22','23','24'], 'D');
  const immoCorpNM = sommeSolde(balanceNMoinsUn, ['22','23','24'], 'D');
  const dImmoCorp  = immoCorpN - immoCorpNM;

  const immoFinancN  = sommeSolde(balanceN, ['26','27'], 'D');
  const immoFinancNM = sommeSolde(balanceNMoinsUn, ['26','27'], 'D');
  const dImmoFinanc  = immoFinancN - immoFinancNM;

  const investissements = Math.max(0, dImmoIncorp) + Math.max(0, dImmoCorp) + Math.max(0, dImmoFinanc);

  // Variation BFE = ΔStocks + ΔClients - ΔFournisseurs exploitation - ΔDettes sociales/fiscales
  const stocksN  = sommeSolde(balanceN, ['31','32','33','34','35','36','37','38'], 'D');
  const stocksNM = sommeSolde(balanceNMoinsUn, ['31','32','33','34','35','36','37','38'], 'D');
  const clientsN  = sommeSolde(balanceN, ['41'], 'D');
  const clientsNM = sommeSolde(balanceNMoinsUn, ['41'], 'D');
  const fournExpN  = sommeSolde(balanceN, ['40'], 'C');
  const fournExpNM = sommeSolde(balanceNMoinsUn, ['40'], 'C');
  const dettesSocFiscN  = sommeSolde(balanceN, ['42','43','44'], 'C');
  const dettesSocFiscNM = sommeSolde(balanceNMoinsUn, ['42','43','44'], 'C');

  const dBFE = (stocksN - stocksNM) + (clientsN - clientsNM)
             - (fournExpN - fournExpNM) - (dettesSocFiscN - dettesSocFiscNM);

  // Variation BFHAO (Besoin de Financement Hors Activités Ordinaires)
  const creancesHAON  = sommeSolde(balanceN, ['485'], 'D');
  const creancesHAONM = sommeSolde(balanceNMoinsUn, ['485'], 'D');
  const dettesHAON    = sommeSolde(balanceN, ['481','482','484'], 'C');
  const dettesHAONM   = sommeSolde(balanceNMoinsUn, ['481','482','484'], 'C');
  const dBFHAO        = (creancesHAON - creancesHAONM) - (dettesHAON - dettesHAONM);

  const emploisTotaux = investissements + Math.max(0, dBFE) + Math.max(0, dBFHAO);

  // ─── IV. Ressources nettes ───────────────────────────────────────────────
  const capitalN  = sommeSolde(balanceN, ['101','102','103','104'], 'C');
  const capitalNM = sommeSolde(balanceNMoinsUn, ['101','102','103','104'], 'C');
  const augmCapital = Math.max(0, capitalN - capitalNM);

  const subvN  = sommeSolde(balanceN, ['14'], 'C');
  const subvNM = sommeSolde(balanceNMoinsUn, ['14'], 'C');
  const subvInvest = Math.max(0, subvN - subvNM);

  const empruntsN  = sommeSolde(balanceN, ['16','17'], 'C');
  const empruntsNM = sommeSolde(balanceNMoinsUn, ['16','17'], 'C');
  const empruntsDelta = empruntsN - empruntsNM;
  const nouveauxEmprunts = Math.max(0, empruntsDelta);
  const remboursementsEmprunts = Math.max(0, -empruntsDelta);

  // Cessions d'immobilisations : produits 82 (cession HAO) ≈ recettes
  const cessionsImmo = sommeMouvement(balanceN, ['82'], 'C');

  const ressourcesTotales = autofinancement + augmCapital + subvInvest + nouveauxEmprunts + cessionsImmo
                          - remboursementsEmprunts;

  // ─── V. Variation de trésorerie ──────────────────────────────────────────
  const tresoActifN  = sommeSolde(balanceN, ['50','51','52','53','54','55','57'], 'D');
  const tresoActifNM = sommeSolde(balanceNMoinsUn, ['50','51','52','53','54','55','57'], 'D');
  const tresoPassifN  = sommeSolde(balanceN, ['56'], 'C');
  const tresoPassifNM = sommeSolde(balanceNMoinsUn, ['56'], 'C');
  const dTresorerie = (tresoActifN - tresoActifNM) - (tresoPassifN - tresoPassifNM);

  // Vérif : Ressources - Emplois - ΔTrésorerie ≈ 0
  const ecart = ressourcesTotales - emploisTotaux - dTresorerie;

  return {
    titre: 'TAFIRE — Tableau Financier des Ressources et Emplois',
    lignes: [
      // CAFG
      { ref: 'AA', libelle: 'EBE', valeur: ebe, niveau: 1 },
      { ref: 'AB', libelle: '+ Transferts de charges d\'exploitation', valeur: transfertsExpl, niveau: 1 },
      { ref: 'AC', libelle: '+ Revenus financiers', valeur: revenusFinanc, niveau: 1 },
      { ref: 'AD', libelle: '+ Produits HAO encaissables', valeur: produitsHAOEnc + transfertsHAO, niveau: 1 },
      { ref: 'AE', libelle: '- Frais financiers', valeur: fraisFinanc, niveau: 1, soustrait: true },
      { ref: 'AF', libelle: '- Charges HAO décaissables', valeur: chargesHAODec, niveau: 1, soustrait: true },
      { ref: 'AG', libelle: '- Participation', valeur: participation, niveau: 1, soustrait: true },
      { ref: 'AH', libelle: '- Impôts sur le résultat', valeur: impotsResult, niveau: 1, soustrait: true },
      { ref: 'AI', libelle: 'CAFG', valeur: cafg, niveau: 0, total: true, surligne: true },
      { ref: 'AJ', libelle: '- Distributions de dividendes', valeur: dividendes, niveau: 1, soustrait: true },
      { ref: 'AK', libelle: 'AUTOFINANCEMENT (AF)', valeur: autofinancement, niveau: 0, total: true, surligne: true },
      // Emplois
      { ref: 'BA', libelle: 'EMPLOIS ÉCONOMIQUES', valeur: null, niveau: 0, section: true },
      { ref: 'BB', libelle: 'Investissements incorporels', valeur: Math.max(0, dImmoIncorp), niveau: 1 },
      { ref: 'BC', libelle: 'Investissements corporels', valeur: Math.max(0, dImmoCorp), niveau: 1 },
      { ref: 'BD', libelle: 'Investissements financiers', valeur: Math.max(0, dImmoFinanc), niveau: 1 },
      { ref: 'BE', libelle: 'Variation BFE (besoin financement exploitation)', valeur: Math.max(0, dBFE), niveau: 1 },
      { ref: 'BF', libelle: 'Variation BFHAO', valeur: Math.max(0, dBFHAO), niveau: 1 },
      { ref: 'BG', libelle: 'TOTAL EMPLOIS', valeur: emploisTotaux, niveau: 0, total: true, surligne: true },
      // Ressources
      { ref: 'CA', libelle: 'RESSOURCES NETTES DE FINANCEMENT', valeur: null, niveau: 0, section: true },
      { ref: 'CB', libelle: 'Autofinancement', valeur: autofinancement, niveau: 1 },
      { ref: 'CC', libelle: 'Augmentations de capital', valeur: augmCapital, niveau: 1 },
      { ref: 'CD', libelle: 'Subventions d\'investissement reçues', valeur: subvInvest, niveau: 1 },
      { ref: 'CE', libelle: 'Nouveaux emprunts', valeur: nouveauxEmprunts, niveau: 1 },
      { ref: 'CF', libelle: '- Remboursements d\'emprunts', valeur: remboursementsEmprunts, niveau: 1, soustrait: true },
      { ref: 'CG', libelle: 'Cessions d\'immobilisations', valeur: cessionsImmo, niveau: 1 },
      { ref: 'CH', libelle: 'TOTAL RESSOURCES', valeur: ressourcesTotales, niveau: 0, total: true, surligne: true },
      // Variation trésorerie
      { ref: 'DA', libelle: 'VARIATION DE TRÉSORERIE', valeur: dTresorerie, niveau: 0, total: true, surligne: true, final: true },
    ],
    cafg,
    autofinancement,
    emplois: emploisTotaux,
    ressources: ressourcesTotales,
    variation_tresorerie: dTresorerie,
    ecart,
  };
}

/**
 * ANNEXES DSF — Formulaires N°3 à N°15 (sélection des plus utiles)
 *
 * V1 (Lot 3) : 5 annexes calculables automatiquement depuis la compta
 *   - Note 3A : Immobilisations (mouvements N : acquisitions/cessions)
 *   - Note 3B : Amortissements (cumul N-1, dotations, cumul N)
 *   - Note 4  : Effectifs (depuis table employes)
 *   - Note 10 : Emprunts (ventilation 16/17 par compte)
 *   - Note 12 : État des créances et dettes (récap 40, 41, 42, 43, 44)
 *
 * Les annexes nécessitant saisie manuelle (commissaires aux comptes,
 * engagements hors bilan, litiges) sont prévues en V2 — l'EC les
 * remplira via une UI dédiée.
 */
async function calculerAnnexes(balanceN, balanceNMoinsUn, entrepriseId, exerciceN, pool) {
  // ── Note 3A : Mouvements des immobilisations brutes ────────────────────
  const catImmo = [
    { ref: 'AD', libelle: 'Frais de développement, brevets, licences', prefixes: ['211','212','213','214','215','216'] },
    { ref: 'AE', libelle: 'Logiciels et sites internet', prefixes: ['213'] },
    { ref: 'AF', libelle: 'Fonds commercial et droits assimilés', prefixes: ['215','216'] },
    { ref: 'AG', libelle: 'Autres immobilisations incorporelles', prefixes: ['217','218'] },
    { ref: 'AJ', libelle: 'Terrains', prefixes: ['22'] },
    { ref: 'AK', libelle: 'Bâtiments, installations techniques', prefixes: ['23'] },
    { ref: 'AL', libelle: 'Matériel et mobilier', prefixes: ['244','245'] },
    { ref: 'AM', libelle: 'Matériel de transport', prefixes: ['245'] },
    { ref: 'AN', libelle: 'Autres immobilisations corporelles', prefixes: ['241','242','243','246','247','248'] },
    { ref: 'AR', libelle: 'Titres de participation', prefixes: ['26'] },
    { ref: 'AS', libelle: 'Autres immobilisations financières', prefixes: ['27'] },
  ];
  const immobilisations = catImmo.map(c => {
    const bN  = sommeSolde(balanceN, c.prefixes, 'D');
    const bNM = balanceNMoinsUn ? sommeSolde(balanceNMoinsUn, c.prefixes, 'D') : 0;
    const delta = bN - bNM;
    return {
      ref: c.ref,
      libelle: c.libelle,
      brut_ouverture: bNM,
      acquisitions: Math.max(0, delta),
      cessions: Math.max(0, -delta),
      brut_cloture: bN,
    };
  }).filter(l => l.brut_ouverture || l.brut_cloture);

  const totauxImmo = immobilisations.reduce((acc, l) => ({
    brut_ouverture: acc.brut_ouverture + l.brut_ouverture,
    acquisitions:   acc.acquisitions + l.acquisitions,
    cessions:       acc.cessions + l.cessions,
    brut_cloture:   acc.brut_cloture + l.brut_cloture,
  }), { brut_ouverture: 0, acquisitions: 0, cessions: 0, brut_cloture: 0 });

  // ── Note 3B : Mouvements des amortissements ─────────────────────────────
  const catAmort = [
    { ref: 'AD', libelle: 'Frais de développement, brevets', prefixes: ['281','282'] },
    { ref: 'AE', libelle: 'Logiciels', prefixes: ['2813'] },
    { ref: 'AJ', libelle: 'Terrains', prefixes: ['282'] },
    { ref: 'AK', libelle: 'Bâtiments', prefixes: ['283'] },
    { ref: 'AL', libelle: 'Matériel et mobilier', prefixes: ['2844','2845'] },
    { ref: 'AN', libelle: 'Autres immo corporelles', prefixes: ['284'] },
  ];
  const amortissements = catAmort.map(c => {
    const cN  = sommeSolde(balanceN, c.prefixes, 'C');
    const cNM = balanceNMoinsUn ? sommeSolde(balanceNMoinsUn, c.prefixes, 'C') : 0;
    const delta = cN - cNM;
    return {
      ref: c.ref,
      libelle: c.libelle,
      cumul_ouverture: cNM,
      dotations: Math.max(0, delta),
      reprises: Math.max(0, -delta),
      cumul_cloture: cN,
    };
  }).filter(l => l.cumul_ouverture || l.cumul_cloture);

  const totauxAmort = amortissements.reduce((acc, l) => ({
    cumul_ouverture: acc.cumul_ouverture + l.cumul_ouverture,
    dotations:       acc.dotations + l.dotations,
    reprises:        acc.reprises + l.reprises,
    cumul_cloture:   acc.cumul_cloture + l.cumul_cloture,
  }), { cumul_ouverture: 0, dotations: 0, reprises: 0, cumul_cloture: 0 });

  // ── Note 4 : Effectifs ──────────────────────────────────────────────────
  // Compte les employés actifs à la fin de l'exercice.
  let effectifs = null;
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE date_embauche <= $2)::int AS embauches_avant_cloture
         FROM employes
        WHERE entreprise_id = $1 AND actif = true`,
      [entrepriseId, exerciceN.date_fin]
    );
    effectifs = {
      total_fin_exercice: r.rows[0].total,
      details: 'Salariés actifs au ' + String(exerciceN.date_fin).slice(0, 10),
    };
  } catch (err) {
    // Table employes non disponible — on retourne null
    effectifs = null;
  }

  // ── Note 10 : Emprunts ──────────────────────────────────────────────────
  // Ventilation par compte 16x / 17x
  const empruntsLignes = [];
  for (const [num, sol] of balanceN) {
    if ((num.startsWith('16') || num.startsWith('17')) && sol.solde_crediteur > 0) {
      empruntsLignes.push({
        compte: num,
        libelle: num.startsWith('16') ? 'Emprunts et dettes financières' : 'Dettes de location-acquisition',
        montant: sol.solde_crediteur,
      });
    }
  }
  const totalEmprunts = empruntsLignes.reduce((s, l) => s + l.montant, 0);

  // ── Note 12 : État des créances et dettes ───────────────────────────────
  const creancesDettes = {
    creances_clients:        sommeSolde(balanceN, ['41'], 'D'),
    autres_creances:         sommeSolde(balanceN, ['42','43','44','45','46','47','48'], 'D'),
    dettes_fournisseurs:     sommeSolde(balanceN, ['40'], 'C'),
    dettes_fiscales:         sommeSolde(balanceN, ['44'], 'C'),
    dettes_sociales:         sommeSolde(balanceN, ['42','43'], 'C'),
    autres_dettes:           sommeSolde(balanceN, ['45','46','47'], 'C'),
  };

  return {
    immobilisations: { lignes: immobilisations, totaux: totauxImmo },
    amortissements:  { lignes: amortissements,  totaux: totauxAmort },
    effectifs,
    emprunts:        { lignes: empruntsLignes, total: totalEmprunts },
    creances_dettes: creancesDettes,
  };
}

/**
 * Génère la liasse DSF complète d'un exercice.
 * Retourne { entreprise, exercice, compte_resultat, bilan_actif, bilan_passif,
 *            tafire, annexes, equilibre }
 */
async function genererLiasseDSF(entrepriseId, exerciceId) {
  // Infos entreprise + exercice
  const entRes = await pool.query(
    'SELECT id, nom, ncc, regime_fiscal, forme_juridique, ville, pays FROM entreprises WHERE id = $1',
    [entrepriseId]
  );
  const ent = entRes.rows[0];
  if (!ent) throw new Error('Entreprise introuvable');

  const exRes = await pool.query(
    'SELECT id, libelle, date_debut, date_fin, cloture FROM exercices WHERE id = $1 AND entreprise_id = $2',
    [exerciceId, entrepriseId]
  );
  const ex = exRes.rows[0];
  if (!ex) throw new Error('Exercice introuvable');

  const balance = await chargerBalance(entrepriseId, exerciceId);
  const compteResultat = calculerCompteResultat(balance);
  const bilanActif     = calculerBilanActif(balance);
  const bilanPassif    = calculerBilanPassif(balance, compteResultat.indicateurs.resultat_net);

  const equilibre = bilanActif.total_net - bilanPassif.total;

  // Pour le TAFIRE : charger la balance de l'exercice N-1 si elle existe
  // (exercice précédent, identifié par date_fin la plus proche < date_debut N).
  let balanceNMoinsUn = null;
  let exerciceNMoinsUn = null;
  try {
    const exPrev = await pool.query(
      `SELECT id, libelle FROM exercices
        WHERE entreprise_id = $1 AND date_fin < $2
        ORDER BY date_fin DESC LIMIT 1`,
      [entrepriseId, ex.date_debut]
    );
    if (exPrev.rows[0]) {
      exerciceNMoinsUn = exPrev.rows[0];
      balanceNMoinsUn = await chargerBalance(entrepriseId, exPrev.rows[0].id);
    }
  } catch (err) {
    // Si la requête échoue, on continue sans N-1 (mode dégradé géré dans calculerTafire)
    console.warn('Chargement exercice N-1 échoué:', err.message);
  }

  const tafire  = calculerTafire(balance, balanceNMoinsUn, compteResultat);
  const annexes = await calculerAnnexes(balance, balanceNMoinsUn, entrepriseId, ex, pool);

  return {
    entreprise: ent,
    exercice: ex,
    exercice_precedent: exerciceNMoinsUn,
    compte_resultat: compteResultat,
    bilan_actif: bilanActif,
    bilan_passif: bilanPassif,
    tafire,
    annexes,
    equilibre,
  };
}

module.exports = {
  chargerBalance,
  calculerCompteResultat,
  calculerBilanActif,
  calculerBilanPassif,
  calculerTafire,
  calculerAnnexes,
  genererLiasseDSF,
};
