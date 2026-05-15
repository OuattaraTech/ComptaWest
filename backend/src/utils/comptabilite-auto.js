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
 * Écriture de facture émise (vente).
 * Compte de produit utilisé : 706 (services) par défaut. Pour ventes de marchandises, passer compteProduit='701'.
 */
const ecritureFacture = async (client, { entrepriseId, utilisateurId, facture, compteProduit = '706' }) => {
  // Devis, proforma : pas d'écriture. Avoir : à traiter séparément.
  if (facture.type !== 'facture') return null;
  if (facture.statut === 'brouillon' || facture.statut === 'annulee') return null;

  return safeAuto(`facture ${facture.numero}`, () =>
    creerEcriture(client, {
      entrepriseId,
      utilisateurId,
      journalCode: 'VTE',
      date: facture.date_emission,
      libelle: `Facture ${facture.numero}`,
      reference: facture.numero,
      origine: 'AUTO_FACTURE',
      origineId: facture.id,
      lignes: [
        // Débit : créance client
        { compte: '4111', debit: round2(facture.total_ttc), libelle: `Client ${facture.numero}` },
        // Crédit : produit (HT)
        { compte: compteProduit, credit: round2(facture.sous_total), libelle: `Vente ${facture.numero}` },
        // Crédit : TVA collectée (si applicable)
        ...(round2(facture.montant_tva) > 0
          ? [{ compte: '4431', credit: round2(facture.montant_tva), libelle: `TVA collectée ${facture.numero}` }]
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
 */
const ecritureDepense = async (client, { entrepriseId, utilisateurId, depense, compteCharge }) => {
  if (depense.statut === 'annulee') return null;

  // Si la catégorie a un code SYSCOHADA propre on l'utilise, sinon fallback
  const codeCategorie = compteCharge || depense.categorie_code || '658';
  // Le code SYSCOHADA peut contenir des suffixes maison (ex: "62T", "62L") — on garde la racine
  const compteChargeFinal = /^[1-9]/.test(codeCategorie) ? codeCategorie.replace(/[^0-9]/g, '') || '658' : '658';

  // Décide si paiement direct (BNK/CAI/MM) ou crédit fournisseur (ACH puis paiement séparé)
  const enCredit = depense.statut === 'en_attente';
  const journal = enCredit ? 'ACH'
    : depense.mode_paiement === 'cash' ? 'CAI'
    : depense.mode_paiement === 'mobile_money' ? 'MM'
    : 'BNK';

  const compteContrepartie = enCredit ? '4011' : compteTresorerie(depense.mode_paiement);

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
 * Schéma SYSCOHADA (plan ComptaWest) :
 *   661 Rémunérations directes              (D) brut_total
 *   664 Charges sociales patronales         (D) total_cotisations_patronales
 *       422 Personnel - rémunérations dues   (C) net_a_payer
 *       431 Sécurité sociale                 (C) total_cotisations_salariales + total_cotisations_patronales
 *       4471 État - ITS retenu               (C) total_impots
 *       421 Personnel - avances et acomptes  (C) total_retenues (solde des avances/acomptes versés)
 *
 * Note sur le plan : dans ComptaWest, 422 = net à payer (PASSIF) et 421 = avances/
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

module.exports = {
  ecritureFacture, ecriturePaiementFacture, ecriturePaiementFournisseur,
  ecritureDepense, ecriturePaiementTaxe,
  ecritureBulletinValidation, ecriturePaiementBulletin,
  COMPTES_TRESORERIE, COMPTE_TAXE,
};
