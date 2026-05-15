/**
 * Module de clôture d'exercice — SYSCOHADA.
 *
 * Orchestre les opérations comptables de fin d'exercice :
 *   - Calcul des soldes par compte (classes 6/7 pour le résultat, 1-5 pour le bilan)
 *   - Écritures de virement des charges et produits vers le compte 13 (résultat)
 *   - Création de l'exercice N+1
 *   - Écriture de reprise à nouveau (AN) sur les soldes de bilan
 *
 * Sécurité : une fois `exercices.cloture = true`, `creerEcriture` refuse toute
 * nouvelle écriture dont la date tombe dans cet exercice (cf. trouverExerciceOuvert).
 */
const { creerEcriture, ComptaError, round2 } = require('./comptabilite');

const COMPTE_RESULTAT = '13'; // Résultat net de l'exercice (collectif SYSCOHADA)

/**
 * Calcule la balance (debit - credit) par compte sur un exercice, pour les
 * comptes dont le numéro commence par l'un des préfixes fournis.
 * Renvoie [{ compte_numero, solde }] où solde > 0 = débiteur, < 0 = créditeur.
 */
const calculerSoldes = async (client, entrepriseId, exerciceId, prefixes) => {
  const r = await client.query(
    `SELECT l.compte_numero,
            SUM(l.debit) - SUM(l.credit) AS solde
       FROM lignes_ecriture l
       JOIN ecritures e ON e.id = l.ecriture_id
      WHERE e.entreprise_id = $1
        AND e.exercice_id = $2
        AND LEFT(l.compte_numero, 1) = ANY($3)
      GROUP BY l.compte_numero
     HAVING ABS(SUM(l.debit) - SUM(l.credit)) > 0.01
      ORDER BY l.compte_numero`,
    [entrepriseId, exerciceId, prefixes]
  );
  return r.rows.map(row => ({
    compte_numero: row.compte_numero,
    solde: round2(row.solde),
  }));
};

/**
 * Vérifications préalables à la clôture. Renvoie une liste de contrôles
 * avec leur statut (ok / warning / error) et un message.
 */
const verifierPreCloture = async (client, entrepriseId, exerciceId, dateFin) => {
  const checks = [];

  // 1. L'exercice n'est pas déjà clôturé
  const exRes = await client.query(
    `SELECT cloture FROM exercices WHERE id = $1 AND entreprise_id = $2`,
    [exerciceId, entrepriseId]
  );
  if (exRes.rows.length === 0) {
    checks.push({ code: 'EXERCICE_INTROUVABLE', niveau: 'error', message: 'Exercice introuvable' });
    return checks;
  }
  if (exRes.rows[0].cloture) {
    checks.push({ code: 'DEJA_CLOTURE', niveau: 'error', message: 'Exercice déjà clôturé' });
    return checks;
  }
  checks.push({ code: 'EXERCICE_OUVERT', niveau: 'ok', message: 'Exercice ouvert' });

  // 2. Pas de facture comptable (type='facture' ou 'avoir') en brouillon sur l'exercice.
  //    Les devis/proformas en brouillon n'impactent pas la compta, on les ignore.
  const brouillons = await client.query(
    `SELECT COUNT(*)::int AS nb FROM factures
      WHERE entreprise_id = $1
        AND statut = 'brouillon'
        AND type IN ('facture', 'avoir')
        AND date_emission BETWEEN
            (SELECT date_debut FROM exercices WHERE id = $2)
        AND (SELECT date_fin FROM exercices WHERE id = $2)`,
    [entrepriseId, exerciceId]
  );
  if (brouillons.rows[0].nb > 0) {
    checks.push({
      code: 'FACTURES_BROUILLON', niveau: 'error',
      message: `${brouillons.rows[0].nb} facture(s) en brouillon — à valider ou supprimer avant clôture`,
    });
  } else {
    checks.push({ code: 'FACTURES_BROUILLON', niveau: 'ok', message: 'Aucune facture en brouillon' });
  }

  // 3. Équilibre global des écritures de l'exercice
  const eq = await client.query(
    `SELECT COALESCE(SUM(l.debit), 0) AS d, COALESCE(SUM(l.credit), 0) AS c
       FROM lignes_ecriture l
       JOIN ecritures e ON e.id = l.ecriture_id
      WHERE e.entreprise_id = $1 AND e.exercice_id = $2`,
    [entrepriseId, exerciceId]
  );
  const totalD = round2(eq.rows[0].d);
  const totalC = round2(eq.rows[0].c);
  if (Math.abs(totalD - totalC) > 0.01) {
    checks.push({
      code: 'BALANCE_DESEQUILIBREE', niveau: 'error',
      message: `Balance déséquilibrée : débit=${totalD}, crédit=${totalC}`,
    });
  } else {
    checks.push({
      code: 'BALANCE_EQUILIBREE', niveau: 'ok',
      message: `Balance équilibrée : ${totalD} FCFA en débit et en crédit`,
    });
  }

  // 4. Existe-t-il des dotations d'amortissement pour l'année ? (warning si non)
  const annee = new Date(dateFin).getFullYear();
  const dot = await client.query(
    `SELECT COUNT(*)::int AS nb FROM dotations_amortissement d
       JOIN immobilisations i ON i.id = d.immobilisation_id
      WHERE i.entreprise_id = $1 AND d.annee = $2`,
    [entrepriseId, annee]
  );
  const nbImmos = await client.query(
    `SELECT COUNT(*)::int AS nb FROM immobilisations
      WHERE entreprise_id = $1 AND statut = 'en_service'`,
    [entrepriseId]
  );
  if (nbImmos.rows[0].nb > 0 && dot.rows[0].nb === 0) {
    checks.push({
      code: 'DOTATIONS_MANQUANTES', niveau: 'warning',
      message: `${nbImmos.rows[0].nb} immobilisation(s) en service mais aucune dotation passée pour ${annee} — pensez à générer les dotations`,
    });
  } else if (nbImmos.rows[0].nb > 0) {
    checks.push({
      code: 'DOTATIONS', niveau: 'ok',
      message: `${dot.rows[0].nb} dotation(s) d'amortissement passée(s)`,
    });
  }

  // 5. Résultat prévisionnel
  const soldes = await calculerSoldes(client, entrepriseId, exerciceId, ['6', '7']);
  const totalCharges = soldes.filter(s => s.compte_numero.startsWith('6'))
                              .reduce((sum, s) => sum + Math.max(s.solde, 0), 0);
  const totalProduits = soldes.filter(s => s.compte_numero.startsWith('7'))
                              .reduce((sum, s) => sum - Math.min(s.solde, 0), 0);
  const resultat = round2(totalProduits - totalCharges);
  checks.push({
    code: 'RESULTAT_PREVISIONNEL', niveau: 'ok',
    message: `Résultat prévisionnel : ${resultat} FCFA (${resultat >= 0 ? 'bénéfice' : 'perte'})`,
    data: { totalCharges: round2(totalCharges), totalProduits: round2(totalProduits), resultat },
  });

  return checks;
};

/**
 * Génère l'écriture de virement des charges au compte de résultat.
 * Format : 13 (D total) / 60x, 61x, ... (C solde de chaque compte)
 * Ne génère rien si pas de charges à solder.
 */
const ecritureSoldeCharges = async (client, { entrepriseId, utilisateurId, exercice }) => {
  const soldes = await calculerSoldes(client, entrepriseId, exercice.id, ['6']);
  // On ne prend que les comptes à solde débiteur (cas normal des charges)
  const aSolder = soldes.filter(s => s.solde > 0);
  if (aSolder.length === 0) return null;

  const total = aSolder.reduce((sum, s) => sum + s.solde, 0);
  const lignes = [
    {
      compte: COMPTE_RESULTAT, debit: round2(total),
      libelle: `Virement des charges au résultat`,
    },
    ...aSolder.map(s => ({
      compte: s.compte_numero, credit: s.solde,
      libelle: `Solde ${s.compte_numero}`,
    })),
  ];

  return creerEcriture(client, {
    entrepriseId, utilisateurId,
    journalCode: 'OD',
    date: exercice.date_fin,
    libelle: `Clôture ${exercice.libelle} — solde des charges (classe 6)`,
    origine: 'AUTO_CLOTURE',
    origineId: exercice.id,
    lignes,
  });
};

/**
 * Génère l'écriture de virement des produits au compte de résultat.
 * Format : 70x, 71x, ... (D solde de chaque compte) / 13 (C total)
 */
const ecritureSoldeProduits = async (client, { entrepriseId, utilisateurId, exercice }) => {
  const soldes = await calculerSoldes(client, entrepriseId, exercice.id, ['7']);
  // Produits = solde créditeur (négatif dans notre convention debit-credit)
  const aSolder = soldes.filter(s => s.solde < 0).map(s => ({
    compte_numero: s.compte_numero, solde: -s.solde, // on rebascule en positif
  }));
  if (aSolder.length === 0) return null;

  const total = aSolder.reduce((sum, s) => sum + s.solde, 0);
  const lignes = [
    ...aSolder.map(s => ({
      compte: s.compte_numero, debit: s.solde,
      libelle: `Solde ${s.compte_numero}`,
    })),
    {
      compte: COMPTE_RESULTAT, credit: round2(total),
      libelle: `Virement des produits au résultat`,
    },
  ];

  return creerEcriture(client, {
    entrepriseId, utilisateurId,
    journalCode: 'OD',
    date: exercice.date_fin,
    libelle: `Clôture ${exercice.libelle} — solde des produits (classe 7)`,
    origine: 'AUTO_CLOTURE',
    origineId: exercice.id,
    lignes,
  });
};

/**
 * Crée l'exercice N+1 (s'il n'existe pas déjà) et renvoie son id + date de début.
 * Hypothèse SYSCOHADA : année civile (1er janvier → 31 décembre).
 */
const creerExerciceSuivant = async (client, { entrepriseId, exerciceCloture }) => {
  const dateFin = new Date(exerciceCloture.date_fin);
  const dateDebutN1 = new Date(dateFin);
  dateDebutN1.setDate(dateDebutN1.getDate() + 1);
  const annee = dateDebutN1.getFullYear();
  const dateDebutStr = dateDebutN1.toISOString().split('T')[0];
  const dateFinStr = `${annee}-12-31`;

  const existe = await client.query(
    `SELECT id FROM exercices WHERE entreprise_id = $1 AND date_debut = $2`,
    [entrepriseId, dateDebutStr]
  );
  if (existe.rows[0]) {
    return { id: existe.rows[0].id, date_debut: dateDebutStr, libelle: `Exercice ${annee}` };
  }

  const r = await client.query(
    `INSERT INTO exercices (entreprise_id, libelle, date_debut, date_fin)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [entrepriseId, `Exercice ${annee}`, dateDebutStr, dateFinStr]
  );
  return { id: r.rows[0].id, date_debut: dateDebutStr, libelle: `Exercice ${annee}` };
};

/**
 * Écriture de reprise à nouveau (journal AN) au 1er jour de l'exercice N+1 :
 * reporte les soldes des comptes de bilan (classes 1 à 5) ainsi que le résultat
 * (compte 13) qui reste en attente d'affectation.
 *
 * Note : la sécurité de `creerEcriture` (trouverExerciceOuvert) exige que
 * l'exercice N+1 soit déjà créé AVANT cet appel.
 */
const ecritureAANouveau = async (client, { entrepriseId, utilisateurId, exerciceCloture, dateDebutN1, libelleN1 }) => {
  // Soldes des comptes de bilan (1-5) + du résultat (13) après les écritures de clôture
  const soldes = await calculerSoldes(client, entrepriseId, exerciceCloture.id, ['1', '2', '3', '4', '5']);
  if (soldes.length === 0) return null;

  const lignes = soldes.map(s => {
    if (s.solde > 0) {
      // Solde débiteur (souvent actif) → débit en N+1
      return {
        compte: s.compte_numero, debit: s.solde,
        libelle: `À nouveau ${s.compte_numero}`,
      };
    }
    // Solde créditeur (souvent passif) → crédit en N+1
    return {
      compte: s.compte_numero, credit: -s.solde,
      libelle: `À nouveau ${s.compte_numero}`,
    };
  });

  // Par construction (toutes écritures équilibrées + virement des 6/7),
  // la somme des soldes de bilan est équilibrée. Mais on protège quand même.
  const totalD = lignes.reduce((s, l) => s + (l.debit || 0), 0);
  const totalC = lignes.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalD - totalC) > 0.01) {
    throw new ComptaError(
      `Soldes de bilan déséquilibrés à la reprise : D=${totalD} ≠ C=${totalC}`,
      'AN_DESEQUILIBRE'
    );
  }

  return creerEcriture(client, {
    entrepriseId, utilisateurId,
    journalCode: 'AN',
    date: dateDebutN1,
    libelle: `Reprise à nouveau — ${libelleN1}`,
    origine: 'AUTO_AN',
    origineId: exerciceCloture.id,
    lignes,
  });
};

module.exports = {
  COMPTE_RESULTAT,
  calculerSoldes,
  verifierPreCloture,
  ecritureSoldeCharges,
  ecritureSoldeProduits,
  creerExerciceSuivant,
  ecritureAANouveau,
};
