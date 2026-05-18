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

  // 5. Soldes atypiques (compte 6 créditeur ou compte 7 débiteur) — informatif
  const soldes = await calculerSoldes(client, entrepriseId, exerciceId, ['6', '7']);
  const atypiques = [
    ...soldes.filter(s => s.compte_numero.startsWith('6') && s.solde < 0),
    ...soldes.filter(s => s.compte_numero.startsWith('7') && s.solde > 0),
  ];
  if (atypiques.length > 0) {
    checks.push({
      code: 'SOLDES_ATYPIQUES', niveau: 'warning',
      message: `${atypiques.length} solde(s) atypique(s) en classe 6/7 (${atypiques.map(a => a.compte_numero).join(', ')}). La clôture les traitera correctement mais vérifiez la cohérence métier.`,
    });
  }

  // 6. Résultat prévisionnel — somme algébrique réelle (prend en compte les atypiques).
  //    Pour la classe 6, on totalise les soldes débiteurs nets ; pour la classe 7,
  //    les soldes créditeurs nets. Résultat = produits − charges.
  const soldeNetClasse = (prefix) => soldes
    .filter(s => s.compte_numero.startsWith(prefix))
    .reduce((sum, s) => sum + s.solde, 0);
  const totalCharges  = round2(soldeNetClasse('6'));     // > 0 si charges nettes débitrices (normal)
  const totalProduits = round2(-soldeNetClasse('7'));    // > 0 si produits nets créditeurs (normal)
  const resultat = round2(totalProduits - totalCharges);
  checks.push({
    code: 'RESULTAT_PREVISIONNEL', niveau: 'ok',
    message: `Résultat prévisionnel : ${resultat} FCFA (${resultat >= 0 ? 'bénéfice' : 'perte'})`,
    data: { totalCharges, totalProduits, resultat },
  });

  return checks;
};

/**
 * Construit les lignes de virement d'un ensemble de soldes vers le compte 13.
 * Gère les soldes typiques ET atypiques (compte 6 créditeur ou compte 7 débiteur,
 * cas réels : avoir total dépassant les ventes du compte, OD de régularisation).
 *
 *   Pour chaque compte avec solde D > 0 : ligne (compte C |solde|) → vient en D du 13
 *   Pour chaque compte avec solde C > 0 : ligne (compte D |solde|) → vient en C du 13
 *   La contrepartie 13 a un solde net (D ou C) reflétant le total algébrique.
 *
 * Renvoie { lignes, netVersResultat } ; lignes inclut déjà la contrepartie 13.
 * Renvoie null s'il n'y a aucun solde à virer.
 */
const _construireVirement = (aSolder, libelleSens) => {
  if (aSolder.length === 0) return null;

  let totalNet = 0; // > 0 = solde débiteur net de la classe → débit 13
  const lignesComptes = aSolder.map(s => {
    totalNet += s.solde;
    return s.solde > 0
      ? { compte: s.compte_numero, credit: round2(s.solde), libelle: `Solde ${s.compte_numero}` }
      : { compte: s.compte_numero, debit: round2(-s.solde), libelle: `Solde atypique ${s.compte_numero}` };
  });

  if (Math.abs(totalNet) < 0.01) {
    // Net algébriquement nul : on solde quand même chaque compte individuellement
    // (les comptes atypiques et typiques se compensent au niveau classe). Pas de
    // ligne 13 nécessaire. Mais creerEcriture exige >= 2 lignes équilibrées,
    // donc si seulement 1 compte avec solde≈0 il n'y a rien à faire (early null).
    if (lignesComptes.length < 2) return null;
    return { lignes: lignesComptes, netVersResultat: 0 };
  }

  const ligne13 = totalNet > 0
    ? { compte: COMPTE_RESULTAT, debit: round2(totalNet), libelle: `Virement ${libelleSens} au résultat` }
    : { compte: COMPTE_RESULTAT, credit: round2(-totalNet), libelle: `Virement ${libelleSens} au résultat` };

  return { lignes: [ligne13, ...lignesComptes], netVersResultat: round2(totalNet) };
};

/**
 * Génère l'écriture de virement des charges (classe 6) au compte de résultat.
 * Accepte les soldes atypiques (compte 6 créditeur après régularisation).
 */
const ecritureSoldeCharges = async (client, { entrepriseId, utilisateurId, exercice }) => {
  const soldes = await calculerSoldes(client, entrepriseId, exercice.id, ['6']);
  const aSolder = soldes.filter(s => Math.abs(s.solde) > 0.01);
  const virement = _construireVirement(aSolder, 'des charges');
  if (!virement) return null;

  return creerEcriture(client, {
    entrepriseId, utilisateurId,
    journalCode: 'OD',
    date: exercice.date_fin,
    libelle: `Clôture ${exercice.libelle} — solde des charges (classe 6)`,
    origine: 'AUTO_CLOTURE',
    origineId: exercice.id,
    lignes: virement.lignes,
  });
};

/**
 * Génère l'écriture de virement des produits (classe 7) au compte de résultat.
 * Accepte les soldes atypiques (compte 7 débiteur après avoir excédentaire).
 */
const ecritureSoldeProduits = async (client, { entrepriseId, utilisateurId, exercice }) => {
  const soldes = await calculerSoldes(client, entrepriseId, exercice.id, ['7']);
  const aSolder = soldes.filter(s => Math.abs(s.solde) > 0.01);
  // Pour les produits, le sens "normal" est solde créditeur. _construireVirement
  // produit naturellement ligne 13 au crédit dans ce cas (totalNet < 0).
  const virement = _construireVirement(aSolder, 'des produits');
  if (!virement) return null;

  const lignes = virement.lignes;

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
 * Génère l'écriture de virement des comptes HAO (classe 8) au compte de résultat.
 *
 * La classe 8 SYSCOHADA mélange charges (81, 83, 85, 87, 89) et produits
 * (82, 84, 86, 88) — y compris 89 « Impôts sur le résultat », qui doit
 * impérativement être viré sinon le résultat net 13 est faussé et l'IS reste
 * sur N+1.
 *
 * _construireVirement est agnostique du sens : il accepte n'importe quel mix
 * et produit la contrepartie 13 selon le solde algébrique global.
 */
const ecritureSoldeHAO = async (client, { entrepriseId, utilisateurId, exercice }) => {
  const soldes = await calculerSoldes(client, entrepriseId, exercice.id, ['8']);
  const aSolder = soldes.filter(s => Math.abs(s.solde) > 0.01);
  const virement = _construireVirement(aSolder, 'des HAO');
  if (!virement) return null;

  return creerEcriture(client, {
    entrepriseId, utilisateurId,
    journalCode: 'OD',
    date: exercice.date_fin,
    libelle: `Clôture ${exercice.libelle} — solde des HAO (classe 8)`,
    origine: 'AUTO_CLOTURE',
    origineId: exercice.id,
    lignes: virement.lignes,
  });
};

/**
 * Crée l'exercice N+1 (s'il n'existe pas déjà) et renvoie son id + date de début.
 * Hypothèse SYSCOHADA : année civile (1er janvier → 31 décembre).
 *
 * Note : on parse la date de fin manuellement plutôt que via `new Date(...)`
 * pour éviter les surprises de fuseau horaire si le serveur tourne en UTC+X.
 * Le format attendu en BD est `YYYY-MM-DD` ; PostgreSQL renvoie soit cette
 * chaîne, soit un objet Date selon le driver — on gère les deux.
 */
const creerExerciceSuivant = async (client, { entrepriseId, exerciceCloture }) => {
  const dateFinStrIso = exerciceCloture.date_fin instanceof Date
    ? exerciceCloture.date_fin.toISOString().slice(0, 10)
    : String(exerciceCloture.date_fin).slice(0, 10);
  const [y, m, d] = dateFinStrIso.split('-').map(Number);

  // Calcul du jour suivant en arithmétique simple (sans Date).
  // Fonctionne pour tout 31/12 → 1/1 (cas standard SYSCOHADA), et tolère
  // un exercice non-calendaire qui finirait en milieu d'année.
  const joursDansMois = (yy, mm) => {
    if (mm === 2) return ((yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0) ? 29 : 28;
    return [4, 6, 9, 11].includes(mm) ? 30 : 31;
  };
  let yy = y, mm = m, dd = d + 1;
  if (dd > joursDansMois(yy, mm)) { dd = 1; mm += 1; }
  if (mm > 12) { mm = 1; yy += 1; }
  const annee = yy;
  const dateDebutStr = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  // Fin par défaut : 31/12 de la même année (peut être ajusté manuellement
  // pour un exercice non calendaire — l'utilisateur édite l'exercice après).
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
  ecritureSoldeHAO,
  creerExerciceSuivant,
  ecritureAANouveau,
};
