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
 * Génère la liasse DSF complète d'un exercice.
 * Retourne { entreprise, exercice, compte_resultat, bilan_actif, bilan_passif, equilibre }
 * où `equilibre` est l'écart ACTIF - PASSIF (devrait être 0 si la compta est équilibrée).
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

  return {
    entreprise: ent,
    exercice: ex,
    compte_resultat: compteResultat,
    bilan_actif: bilanActif,
    bilan_passif: bilanPassif,
    equilibre,
  };
}

module.exports = {
  chargerBalance,
  calculerCompteResultat,
  calculerBilanActif,
  calculerBilanPassif,
  genererLiasseDSF,
};
