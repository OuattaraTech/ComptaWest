const pool = require('../../config/database');

/**
 * Erreur métier comptable. Permet de distinguer dans les controllers
 * une erreur de saisie/configuration d'une vraie erreur serveur.
 */
class ComptaError extends Error {
  constructor(message, code = 'COMPTA_ERROR') {
    super(message);
    this.name = 'ComptaError';
    this.code = code;
  }
}

/**
 * Centime près. Évite les artefacts de virgule flottante avant comparaison.
 */
const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

/**
 * Numéro de pièce auto par journal et par année : "{JOURNAL}-{ANNEE}-{NNNNN}"
 * Doit être appelé DANS la transaction qui crée l'écriture.
 */
const genererNumeroPiece = async (client, entrepriseId, journalCode, dateEcriture) => {
  const annee = new Date(dateEcriture).getFullYear();
  // LOCK + count pour éviter les doublons concurrents
  await client.query('LOCK TABLE ecritures IN SHARE ROW EXCLUSIVE MODE');
  const res = await client.query(
    `SELECT COUNT(*) FROM ecritures
     WHERE entreprise_id = $1 AND numero_piece LIKE $2`,
    [entrepriseId, `${journalCode}-${annee}-%`]
  );
  const seq = parseInt(res.rows[0].count) + 1;
  return `${journalCode}-${annee}-${String(seq).padStart(5, '0')}`;
};

/**
 * Trouve l'exercice ouvert qui contient la date donnée.
 * Renvoie null si aucun exercice n'est ouvert pour cette date.
 */
const trouverExerciceOuvert = async (client, entrepriseId, date) => {
  const res = await client.query(
    `SELECT id FROM exercices
     WHERE entreprise_id = $1 AND cloture = false
       AND $2::date BETWEEN date_debut AND date_fin
     LIMIT 1`,
    [entrepriseId, date]
  );
  return res.rows[0]?.id || null;
};

/**
 * Trouve l'id du compte par son numéro pour une entreprise donnée.
 * Renvoie null si le compte n'existe pas (l'appelant peut alors lever une erreur).
 */
const trouverCompteParNumero = async (client, entrepriseId, numero) => {
  const res = await client.query(
    'SELECT id FROM plan_comptable WHERE entreprise_id = $1 AND numero = $2 AND actif = true LIMIT 1',
    [entrepriseId, numero]
  );
  return res.rows[0]?.id || null;
};

/**
 * Crée une écriture comptable + ses lignes, dans une transaction.
 *
 * @param {object} client          Connexion postgres (déjà BEGIN, ou le helper en démarre une)
 * @param {object} data
 * @param {string} data.entrepriseId
 * @param {string} data.utilisateurId   Auteur (peut être null pour origine système)
 * @param {string} data.journalCode     Code du journal (VTE, ACH, BNK…)
 * @param {string} data.date            Date de l'écriture (YYYY-MM-DD)
 * @param {string} data.libelle
 * @param {string} [data.reference]
 * @param {string} [data.origine]       AUTO_FACTURE | AUTO_DEPENSE | AUTO_PAIEMENT | AUTO_TAXE | MANUEL
 * @param {string} [data.origineId]
 * @param {Array<{compte:string, libelle?:string, debit?:number, credit?:number, lettrage?:string}>} data.lignes
 *
 * @returns {Promise<{id, numero_piece}>}
 *
 * @throws {ComptaError} si débit ≠ crédit, si compte introuvable, ou si exercice clôturé
 */
const creerEcriture = async (client, data) => {
  const {
    entrepriseId, utilisateurId = null, journalCode, date, libelle,
    reference = null, origine = 'MANUEL', origineId = null, lignes = [],
  } = data;

  if (!Array.isArray(lignes) || lignes.length < 2) {
    throw new ComptaError('Une écriture doit comporter au moins 2 lignes', 'LIGNES_INSUFFISANTES');
  }

  // ─── Validation : équilibre débit/crédit ────────────────────────────────
  let totalDebit = 0, totalCredit = 0;
  for (const l of lignes) {
    const d = round2(l.debit);
    const c = round2(l.credit);
    if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
      throw new ComptaError('Chaque ligne doit avoir UN seul montant débit OU crédit', 'LIGNE_INVALIDE');
    }
    totalDebit  += d;
    totalCredit += c;
  }
  if (round2(totalDebit) !== round2(totalCredit)) {
    throw new ComptaError(
      `Écriture déséquilibrée : débit=${totalDebit} ≠ crédit=${totalCredit}`,
      'DESEQUILIBRE'
    );
  }

  // ─── Résoudre journal, exercice, comptes ────────────────────────────────
  const journalRes = await client.query(
    'SELECT id FROM journaux WHERE entreprise_id=$1 AND code=$2 AND actif=true',
    [entrepriseId, journalCode]
  );
  if (journalRes.rows.length === 0) {
    throw new ComptaError(`Journal "${journalCode}" introuvable ou inactif`, 'JOURNAL_INCONNU');
  }
  const journalId = journalRes.rows[0].id;

  const exerciceId = await trouverExerciceOuvert(client, entrepriseId, date);
  if (!exerciceId) {
    throw new ComptaError(
      `Aucun exercice ouvert ne contient la date ${date}. Ouvrez ou créez l'exercice correspondant.`,
      'EXERCICE_FERME'
    );
  }

  // Résoudre tous les comptes en parallèle
  const comptesIds = {};
  for (const l of lignes) {
    if (!comptesIds[l.compte]) {
      const id = await trouverCompteParNumero(client, entrepriseId, l.compte);
      if (!id) {
        throw new ComptaError(`Compte "${l.compte}" introuvable dans le plan comptable`, 'COMPTE_INCONNU');
      }
      comptesIds[l.compte] = id;
    }
  }

  // ─── Insertion écriture + lignes ────────────────────────────────────────
  const numeroPiece = await genererNumeroPiece(client, entrepriseId, journalCode, date);

  const ecritureRes = await client.query(
    `INSERT INTO ecritures
       (entreprise_id, exercice_id, journal_id, numero_piece, date_ecriture,
        libelle, reference, origine, origine_id, validee, cree_par)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
     RETURNING id, numero_piece`,
    [entrepriseId, exerciceId, journalId, numeroPiece, date,
     libelle, reference, origine, origineId, utilisateurId]
  );
  const ecriture = ecritureRes.rows[0];

  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    await client.query(
      `INSERT INTO lignes_ecriture
         (ecriture_id, compte_id, compte_numero, libelle, debit, credit, lettrage, ordre)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        ecriture.id, comptesIds[l.compte], l.compte, l.libelle || libelle,
        round2(l.debit), round2(l.credit), l.lettrage || null, i,
      ]
    );
  }

  return ecriture;
};

module.exports = { creerEcriture, trouverCompteParNumero, genererNumeroPiece, ComptaError, round2 };
