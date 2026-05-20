/**
 * Génération automatique des écritures comptables SYSCOHADA
 * depuis les actions métier (factures, paiements, dépenses, taxes).
 *
 * Mappings standards SYSCOHADA :
 *   Vente facturée :       411 (D) / 706 ou 701 (C) + 4431 TVA collectée (C)
 *   Achat facturé :        60x ou 62x (D) + 4452 TVA déductible (D) / 401 (C)
 *   Achat payé direct :    60x ou 62x (D) + 4452 TVA (D) / 521|571|541 (C)
 *   Encaissement client :  521|571|541 (D) / 411 (C)
 *   Paiement fournisseur : 401 (D) / 521|571|541 (C)
 *   Paiement TVA :         4441 (D) / 521 (C)
 *   Paiement IS :          441 (D) / 521 (C)
 *   Paiement CNSS :        431x (D) / 521 (C)
 *
 * Toutes les fonctions sont best-effort : elles attrapent leurs propres erreurs
 * pour ne PAS faire échouer l'action métier (la facture s'enregistre même si
 * son écriture échoue — l'utilisateur pourra la passer en OD manuel).
 */
const { creerEcriture, ComptaError, round2 } = require('./comptabilite');
const logger = require('./logger');

// ─── Mapping mode de paiement → compte SYSCOHADA ──────────────────────────
const COMPTES_TRESORERIE = {
  cash:         '5711',  // Caisse siège
  virement:     '5211',  // Banque locale principale
  cheque:       '5211',  // Banque locale
  carte:        '5211',  // Banque
  mobile_money: '541',   // Mobile Money - Wave par défaut (peut être affiné si on a la marque)
};

const compteTresorerie = (mode) => COMPTES_TRESORERIE[mode] || '5211';

/**
 * Codes d'erreur qui doivent ANNULER l'action métier appelante (rollback),
 * et non être avalés. Une écriture sur un exercice clos, une écriture
 * déséquilibrée, un journal manquant ou un compte introuvable traduisent
 * une contrainte forte (ou une configuration cassée) du système comptable :
 * laisser passer l'action métier sans son pendant comptable créerait une
 * incohérence (facture vendue mais hors compta, par ex.). On préfère
 * échouer bruyamment pour que l'admin corrige la configuration.
 */
const ERREURS_BLOQUANTES = new Set([
  'EXERCICE_FERME', 'DESEQUILIBRE', 'JOURNAL_INCONNU', 'COMPTE_INCONNU',
]);

/**
 * Wrapper : exécute fn() en attrapant ComptaError pour les remonter en log lisible.
 * Les erreurs bloquantes (cf. ERREURS_BLOQUANTES) sont relancées pour annuler
 * l'action métier. Les autres ComptaError (compte inconnu, journal absent, etc.)
 * sont loguées mais n'empêchent pas l'action métier (l'utilisateur pourra passer
 * l'écriture en OD manuel).
 */
const safeAuto = async (label, fn) => {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ComptaError) {
      if (ERREURS_BLOQUANTES.has(err.code)) {
        // Propagation : l'action métier appelante doit faire ROLLBACK
        throw err;
      }
      logger.warn('Écriture automatique ignorée', {
        source: 'compta-auto', label, code: err.code, message: err.message,
      });
      return null;
    }
    logger.error('Écriture automatique en échec inattendu', {
      source: 'compta-auto', label, message: err.message, stack: err.stack,
    });
    return null;
  }
};

/**
 * Écriture de facture émise (vente) OU d'avoir (note de crédit).
 *
 * - Type "facture" : D 4111 / C 706 (ou 701) + C 4431 TVA collectée
 * - Type "avoir"   : contre-passation symétrique
 *                    D 706 (ou 701) + D 4431 / C 4111
 *                    (le client n'est plus débiteur du montant remboursé,
 *                     les produits et la TVA collectée sont annulés)
 *
 * Les devis/proformas ne génèrent pas d'écriture (engagement, pas vente).
 * Compte de produit utilisé : 706 (services) par défaut. Pour ventes de marchandises, passer compteProduit='701'.
 */
const ecritureFacture = async (client, { entrepriseId, utilisateurId, facture, compteProduit = '706' }) => {
  if (facture.type !== 'facture' && facture.type !== 'avoir') return null;
  if (facture.statut === 'brouillon' || facture.statut === 'annulee') return null;

  const totalTtc    = round2(facture.total_ttc);
  const sousTotal   = round2(facture.sous_total);
  const montantTva  = round2(facture.montant_tva);
  const estAvoir    = facture.type === 'avoir';

  // Contre-passation : on inverse débit ↔ crédit. Le journal reste VTE
  // (un avoir est une opération de vente négative) et l'origine est
  // distincte pour permettre l'unicité côté (origine, origine_id) si on
  // ajoute l'index plus tard.
  const sensDebit  = (montant) => estAvoir ? { credit: montant } : { debit: montant };
  const sensCredit = (montant) => estAvoir ? { debit: montant }  : { credit: montant };
  const libelleEntete = estAvoir ? `Avoir ${facture.numero}` : `Facture ${facture.numero}`;
  const libelleLignes = estAvoir ? 'Annulation' : 'Vente';

  return safeAuto(libelleEntete, () =>
    creerEcriture(client, {
      entrepriseId,
      utilisateurId,
      journalCode: 'VTE',
      date: facture.date_emission,
      libelle: libelleEntete,
      reference: facture.numero,
      origine: estAvoir ? 'AUTO_AVOIR' : 'AUTO_FACTURE',
      origineId: facture.id,
      lignes: [
        // Créance client (D facture, C avoir)
        { compte: '4111', ...sensDebit(totalTtc), libelle: `Client ${facture.numero}` },
        // Produit HT (C facture, D avoir)
        { compte: compteProduit, ...sensCredit(sousTotal), libelle: `${libelleLignes} ${facture.numero}` },
        // TVA collectée (C facture, D avoir) — si applicable
        ...(montantTva > 0
          ? [{ compte: '4431', ...sensCredit(montantTva), libelle: `TVA collectée ${facture.numero}` }]
          : []),
      ],
    })
  );
};

/**
 * Écriture de paiement d'un fournisseur (décaissement) :
 *   401 (D) compte fournisseur / 521|571|541 (C) trésorerie
 * Utilise le code auxiliaire 4011XXX du fournisseur si disponible et présent
 * dans le plan comptable de l'entreprise, sinon fallback vers le collectif 4011.
 * Le fallback couvre les fournisseurs créés avant que createFournisseur ne seede
 * automatiquement leur compte auxiliaire dans le plan.
 */
const ecriturePaiementFournisseur = async (client, { entrepriseId, utilisateurId, fournisseur, paiement }) => {
  let compteFournisseur = '4011';
  if (fournisseur.code_auxiliaire) {
    const r = await client.query(
      `SELECT 1 FROM plan_comptable WHERE entreprise_id = $1 AND numero = $2 AND actif = true LIMIT 1`,
      [entrepriseId, fournisseur.code_auxiliaire]
    );
    if (r.rows.length > 0) compteFournisseur = fournisseur.code_auxiliaire;
  }
  return safeAuto(`paiement fournisseur ${fournisseur.nom}`, () =>
    creerEcriture(client, {
      entrepriseId,
      utilisateurId,
      journalCode: paiement.mode_paiement === 'cash' ? 'CAI'
                : paiement.mode_paiement === 'mobile_money' ? 'MM'
                : 'BNK',
      date: paiement.date_paiement,
      libelle: `Paiement ${fournisseur.nom}${paiement.reference ? ' - ' + paiement.reference : ''}`.slice(0, 250),
      reference: paiement.reference,
      origine: 'AUTO_PAIEMENT_FRN',
      origineId: paiement.id,
      lignes: [
        { compte: compteFournisseur, debit: round2(paiement.montant), libelle: `Solde dette ${fournisseur.nom}` },
        { compte: compteTresorerie(paiement.mode_paiement), credit: round2(paiement.montant), libelle: `Décaissement ${fournisseur.nom}` },
      ],
    })
  );
};

/**
 * Écriture d'encaissement de facture (paiement reçu).
 */
const ecriturePaiementFacture = async (client, { entrepriseId, utilisateurId, facture, paiement }) => {
  return safeAuto(`paiement facture ${facture.numero}`, () =>
    creerEcriture(client, {
      entrepriseId,
      utilisateurId,
      journalCode: paiement.mode_paiement === 'cash' ? 'CAI'
                : paiement.mode_paiement === 'mobile_money' ? 'MM'
                : 'BNK',
      date: paiement.date_paiement,
      libelle: `Encaissement facture ${facture.numero}`,
      reference: facture.numero,
      origine: 'AUTO_PAIEMENT',
      origineId: paiement.id,
      lignes: [
        { compte: compteTresorerie(paiement.mode_paiement), debit: round2(paiement.montant), libelle: `Encaissement ${facture.numero}` },
        { compte: '4111', credit: round2(paiement.montant), libelle: `Solde client ${facture.numero}` },
      ],
    })
  );
};

/**
 * Écriture de dépense.
 * Si la dépense a un code de catégorie SYSCOHADA (ex : "60", "62T"), on l'utilise comme compte de charge.
 * Sinon fallback "658" (Charges diverses).
 *
 * Pour les dépenses à crédit (statut en_attente), tente d'utiliser le compte
 * auxiliaire du fournisseur (4011XXX) si la dépense est liée à un fournisseur
 * enregistré et que son code auxiliaire existe dans le plan comptable. À
 * défaut, retombe sur le collectif 4011 — c'est ce fallback qui produit, lors
 * du paiement via le module Fournisseurs (qui, lui, cible l'auxiliaire), une
 * balance auxiliaire fantôme. Utiliser l'auxiliaire dès la création de la
 * dépense rend la chaîne D 6xx / C 4011XXX → D 4011XXX / C 5xx cohérente.
 */
const ecritureDepense = async (client, { entrepriseId, utilisateurId, depense, compteCharge }) => {
  if (depense.statut === 'annulee') return null;

  const codeCategorie = compteCharge || depense.categorie_code || '658';
  const compteChargeFinal = /^[1-9]/.test(codeCategorie) ? codeCategorie.replace(/[^0-9]/g, '') || '658' : '658';

  const enCredit = depense.statut === 'en_attente';
  const journal = enCredit ? 'ACH'
    : depense.mode_paiement === 'cash' ? 'CAI'
    : depense.mode_paiement === 'mobile_money' ? 'MM'
    : 'BNK';

  // Résout la contrepartie. Pour une dépense en attente, cherche l'auxiliaire
  // du fournisseur lié si disponible et présent dans le plan.
  let compteContrepartie = enCredit ? '4011' : compteTresorerie(depense.mode_paiement);
  if (enCredit && depense.fournisseur_id) {
    const f = await client.query(
      `SELECT code_auxiliaire FROM fournisseurs WHERE id = $1 AND entreprise_id = $2`,
      [depense.fournisseur_id, entrepriseId]
    );
    const aux = f.rows[0]?.code_auxiliaire;
    if (aux) {
      const present = await client.query(
        `SELECT 1 FROM plan_comptable WHERE entreprise_id = $1 AND numero = $2 AND actif = true LIMIT 1`,
        [entrepriseId, aux]
      );
      if (present.rows.length > 0) compteContrepartie = aux;
    }
  }

  return safeAuto(`dépense ${depense.numero || depense.id}`, () =>
    creerEcriture(client, {
      entrepriseId,
      utilisateurId,
      journalCode: journal,
      date: depense.date_depense,
      libelle: `${depense.fournisseur || depense.description}${depense.numero ? ` - ${depense.numero}` : ''}`.slice(0, 250),
      reference: depense.numero,
      origine: 'AUTO_DEPENSE',
      origineId: depense.id,
      lignes: [
        // Débit : charge HT
        { compte: compteChargeFinal, debit: round2(depense.montant_ht), libelle: depense.description?.slice(0, 200) },
        // Débit : TVA déductible (si applicable)
        ...(round2(depense.montant_tva) > 0
          ? [{ compte: '4452', debit: round2(depense.montant_tva), libelle: `TVA déductible ${depense.numero || ''}` }]
          : []),
        // Crédit : fournisseur ou trésorerie
        { compte: compteContrepartie, credit: round2(depense.montant_ttc), libelle: depense.fournisseur || depense.description },
      ],
    })
  );
};

/**
 * Écriture de paiement de taxe.
 * Mapping : TVA→4441, IS→441, BIC→441, CNSS→4311, CMU→4311, IRVM→4472, Patente→4426
 */
const COMPTE_TAXE = {
  TVA: '4441', IS: '441', BIC: '441',
  CNSS: '4311', CMU: '4311',
  IRVM: '4472', Patente: '4426',
};

const ecriturePaiementTaxe = async (client, { entrepriseId, utilisateurId, taxe, montant, modePaiement = 'virement' }) => {
  const compteTaxe = COMPTE_TAXE[taxe.type_taxe] || '447';

  return safeAuto(`paiement taxe ${taxe.type_taxe}`, () =>
    creerEcriture(client, {
      entrepriseId,
      utilisateurId,
      journalCode: modePaiement === 'cash' ? 'CAI' : modePaiement === 'mobile_money' ? 'MM' : 'BNK',
      date: taxe.date_paiement || new Date().toISOString().split('T')[0],
      libelle: `Paiement ${taxe.type_taxe} (période ${taxe.periode_debut} → ${taxe.periode_fin})`,
      reference: taxe.reference_paiement,
      origine: 'AUTO_TAXE',
      origineId: taxe.id,
      lignes: [
        { compte: compteTaxe, debit: round2(montant), libelle: `Taxe ${taxe.type_taxe}` },
        { compte: compteTresorerie(modePaiement), credit: round2(montant), libelle: `Paiement ${taxe.type_taxe}` },
      ],
    })
  );
};

/**
 * Écriture de constat de la charge salariale d'un bulletin de paie (à la validation).
 * Journal PAI. Date = fin de période (periode_fin).
 *
 * Schéma SYSCOHADA (plan ApeX) :
 *   661 Rémunérations directes              (D) brut_total
 *   664 Charges sociales patronales         (D) total_cotisations_patronales
 *       422 Personnel - rémunérations dues   (C) net_a_payer
 *       431 Sécurité sociale                 (C) total_cotisations_salariales + total_cotisations_patronales
 *       4471 État - ITS retenu               (C) total_impots
 *       421 Personnel - avances et acomptes  (C) total_retenues (solde des avances/acomptes versés)
 *
 * Note sur le plan : dans ApeX, 422 = net à payer (PASSIF) et 421 = avances/
 * acomptes (ACTIF) — l'inverse de la nomenclature SYSCOHADA stricte. Conserver
 * cette correspondance car c'est celle du seed plan_comptable_syscohada.js.
 *
 * Vérification d'équilibre :
 *   brut + cot_pat = net + (cot_sal + cot_pat) + impots + retenues
 *   brut + cot_pat = (brut - cot_sal - impots - retenues) + cot_sal + cot_pat + impots + retenues ✓
 */
const ecritureBulletinValidation = async (client, { entrepriseId, utilisateurId, bulletin }) => {
  const brut     = round2(bulletin.brut_total);
  const cotSal   = round2(bulletin.total_cotisations_salariales);
  const cotPat   = round2(bulletin.total_cotisations_patronales);
  const impots   = round2(bulletin.total_impots);
  const retenues = round2(bulletin.total_retenues);
  const net      = round2(bulletin.net_a_payer);

  if (brut <= 0) return null;

  const lignes = [];
  // Débit : charges
  lignes.push({ compte: '661', debit: brut, libelle: `Salaire brut ${bulletin.nom_complet}` });
  if (cotPat > 0) {
    lignes.push({ compte: '664', debit: cotPat, libelle: `Charges patronales ${bulletin.nom_complet}` });
  }
  // Crédit : dettes envers le salarié, les organismes sociaux, l'État
  if (net > 0) {
    lignes.push({ compte: '422', credit: net, libelle: `Net à payer ${bulletin.nom_complet}` });
  }
  const totalCotisations = round2(cotSal + cotPat);
  if (totalCotisations > 0) {
    lignes.push({ compte: '431', credit: totalCotisations, libelle: `Cotisations sociales à reverser` });
  }
  if (impots > 0) {
    lignes.push({ compte: '4471', credit: impots, libelle: `ITS retenu à la source` });
  }
  if (retenues > 0) {
    // Solde de l'avance/acompte précédemment versé (qui était au débit du 421
    // lors du versement). Une retenue paie donc une dette de l'employé envers
    // l'employeur, et fait disparaître la créance.
    lignes.push({ compte: '421', credit: retenues, libelle: `Retenue sur salaire ${bulletin.nom_complet}` });
  }

  return safeAuto(`bulletin ${bulletin.nom_complet} ${bulletin.mois}/${bulletin.annee}`, () =>
    creerEcriture(client, {
      entrepriseId,
      utilisateurId,
      journalCode: 'PAI',
      date: bulletin.periode_fin,
      libelle: `Paie ${String(bulletin.mois).padStart(2, '0')}/${bulletin.annee} — ${bulletin.nom_complet}`,
      reference: `BULL-${bulletin.matricule || bulletin.id.slice(0, 8)}-${bulletin.annee}${String(bulletin.mois).padStart(2, '0')}`,
      origine: 'AUTO_PAIE',
      origineId: bulletin.id,
      lignes,
    })
  );
};

/**
 * Écriture de paiement effectif d'un bulletin (versement du net au salarié).
 *   421 (D) net_a_payer
 *       521|571 (C) compte de trésorerie
 *
 * Le mode de paiement est dérivé du type de compte de trésorerie ; si on n'a pas
 * cette info, on suppose un virement bancaire.
 */
const ecriturePaiementBulletin = async (client, { entrepriseId, utilisateurId, bulletin, datePaiement, typeCompte }) => {
  const net = round2(bulletin.net_a_payer);
  if (net <= 0) return null;

  const modePaiement = typeCompte === 'caisse' ? 'cash'
                     : typeCompte === 'mobile_money' ? 'mobile_money'
                     : 'virement';
  const journalCode = modePaiement === 'cash' ? 'CAI'
                    : modePaiement === 'mobile_money' ? 'MM'
                    : 'BNK';

  return safeAuto(`paiement bulletin ${bulletin.nom_complet}`, () =>
    creerEcriture(client, {
      entrepriseId,
      utilisateurId,
      journalCode,
      date: datePaiement,
      libelle: `Versement salaire ${bulletin.nom_complet} (${String(bulletin.mois).padStart(2, '0')}/${bulletin.annee})`,
      reference: `BULL-${bulletin.matricule || bulletin.id.slice(0, 8)}-${bulletin.annee}${String(bulletin.mois).padStart(2, '0')}`,
      origine: 'AUTO_PAIE_VERSEMENT',
      origineId: bulletin.id,
      lignes: [
        { compte: '422', debit: net, libelle: `Solde dette ${bulletin.nom_complet}` },
        { compte: compteTresorerie(modePaiement), credit: net, libelle: `Versement ${bulletin.nom_complet}` },
      ],
    })
  );
};

/**
 * Écriture de liquidation mensuelle (ou trimestrielle) de la TVA.
 *
 * À chaque déclaration de TVA, on solde les comptes 4431 (collectée) et 4452
 * (déductible) en virant la différence soit en 4441 (TVA due, dette envers
 * l'État), soit en 4449 (crédit de TVA à reporter sur le mois suivant).
 *
 *   D 4431  (collectée du mois)
 *       C 4452  (déductible du mois)
 *       C 4441  (TVA due) — si collectée > déductible
 *   ou
 *   D 4449  (crédit à reporter) — si déductible > collectée
 *
 * Recalcule collectée/déductible depuis les factures et dépenses de la période
 * pour rester aligné sur la source de vérité. Si la déclaration a un
 * montant_du divergent de plus de 1 FCFA, on saute l'écriture (l'utilisateur
 * passera une OD manuelle pour la régularisation).
 */
const ecritureLiquidationTVA = async (client, { entrepriseId, utilisateurId, taxe }) => {
  if (taxe.type_taxe !== 'TVA') return null;

  // Collectée nette : ventes - avoirs sur la période, hors brouillon/annulée
  const collecteeRes = await client.query(
    `SELECT COALESCE(SUM(
              CASE WHEN type = 'avoir' THEN -montant_tva ELSE montant_tva END
            ), 0) AS total
       FROM factures
      WHERE entreprise_id = $1
        AND type IN ('facture','avoir')
        AND date_emission BETWEEN $2 AND $3
        AND statut NOT IN ('brouillon','annulee')`,
    [entrepriseId, taxe.periode_debut, taxe.periode_fin]
  );
  // Déductible : seulement les dépenses effectivement payées sur la période
  const deductibleRes = await client.query(
    `SELECT COALESCE(SUM(montant_tva), 0) AS total
       FROM depenses
      WHERE entreprise_id = $1
        AND date_depense BETWEEN $2 AND $3
        AND statut = 'payee'`,
    [entrepriseId, taxe.periode_debut, taxe.periode_fin]
  );

  const collectee  = round2(collecteeRes.rows[0].total);
  const deductible = round2(deductibleRes.rows[0].total);
  const dueAttendue = round2(collectee - deductible);

  if (collectee === 0 && deductible === 0) return null;

  // Coupe-circuit : si la déclaration a été saisie manuellement avec un
  // montant divergent, on n'écrit pas — la liquidation comptable ne refléterait
  // pas la déclaration officielle. Tolérance 1 FCFA pour les arrondis.
  if (Math.abs(round2(taxe.montant_du) - Math.max(0, dueAttendue)) > 1) {
    return null;
  }

  const periodeLib = `${String(taxe.periode_debut).slice(0, 10)} → ${String(taxe.periode_fin).slice(0, 10)}`;
  const lignes = [];
  if (collectee > 0) {
    lignes.push({ compte: '4431', debit: collectee, libelle: `TVA collectée ${periodeLib}` });
  }
  if (deductible > 0) {
    lignes.push({ compte: '4452', credit: deductible, libelle: `TVA déductible ${periodeLib}` });
  }
  if (dueAttendue > 0) {
    lignes.push({ compte: '4441', credit: dueAttendue, libelle: `TVA due à reverser ${periodeLib}` });
  } else if (dueAttendue < 0) {
    lignes.push({ compte: '4449', debit: -dueAttendue, libelle: `Crédit TVA à reporter ${periodeLib}` });
  }

  // creerEcriture exige >= 2 lignes. Cas pathologique (collectée = déductible
  // et tous deux nuls) déjà filtré plus haut.
  if (lignes.length < 2) return null;

  return safeAuto(`liquidation TVA ${periodeLib}`, () =>
    creerEcriture(client, {
      entrepriseId,
      utilisateurId,
      journalCode: 'OD',
      date: taxe.periode_fin,
      libelle: `Liquidation TVA ${periodeLib}`,
      reference: taxe.id,
      origine: 'AUTO_TVA_LIQUIDATION',
      origineId: taxe.id,
      lignes,
    })
  );
};

module.exports = {
  ecritureFacture, ecriturePaiementFacture, ecriturePaiementFournisseur,
  ecritureDepense, ecriturePaiementTaxe, ecritureLiquidationTVA,
  ecritureBulletinValidation, ecriturePaiementBulletin,
  COMPTES_TRESORERIE, COMPTE_TAXE,
};
