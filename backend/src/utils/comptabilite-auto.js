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
 * Wrapper : exécute fn() en attrapant ComptaError pour les remonter en log lisible.
 * Les autres erreurs sont relancées (probablement bug).
 */
const safeAuto = async (label, fn) => {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ComptaError) {
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

module.exports = {
  ecritureFacture, ecriturePaiementFacture,
  ecritureDepense, ecriturePaiementTaxe,
  COMPTES_TRESORERIE, COMPTE_TAXE,
};
