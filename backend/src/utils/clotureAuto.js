/**
 * Moteur de suggestions d'écritures de clôture pré-DSF.
 *
 * V1 : 3 types de suggestions détectées automatiquement :
 *   1. Provisions clients douteux (factures impayées > 6 mois)
 *   2. Constatation de la TVA à reverser/déduire (solde 44571 - 44566)
 *   3. Régularisation des soldes anormaux (compte 471/472 transferts)
 *
 * Chaque suggestion retourne une proposition d'écriture comptable
 * (date, libellé, lignes débit/crédit) que l'EC peut valider en lot
 * ou ajuster individuellement.
 */
const pool = require('../../config/database');

// Tolérance d'arrondi (FCFA)
const EPS = 1;

/**
 * Charge la balance de l'exercice (réutilisé depuis dsf.js).
 */
async function chargerBalance(entrepriseId, exerciceId) {
  const r = await pool.query(`
    SELECT le.compte_numero AS num,
           COALESCE(SUM(le.debit), 0)  AS debit,
           COALESCE(SUM(le.credit), 0) AS credit
      FROM lignes_ecriture le
      JOIN ecritures e ON e.id = le.ecriture_id
     WHERE e.entreprise_id = $1 AND e.exercice_id = $2 AND e.validee = true
     GROUP BY le.compte_numero
  `, [entrepriseId, exerciceId]);
  const map = new Map();
  for (const row of r.rows) {
    const debit = parseFloat(row.debit) || 0;
    const credit = parseFloat(row.credit) || 0;
    map.set(row.num, {
      debit, credit,
      solde_debiteur: Math.max(0, debit - credit),
      solde_crediteur: Math.max(0, credit - debit),
    });
  }
  return map;
}

/**
 * Génère toutes les suggestions de clôture pour un exercice.
 */
async function genererSuggestionsCloture(entrepriseId, exerciceId) {
  const suggestions = [];

  // Infos de l'exercice
  const exR = await pool.query(
    'SELECT id, date_debut, date_fin FROM exercices WHERE id = $1 AND entreprise_id = $2',
    [exerciceId, entrepriseId]
  );
  if (exR.rows.length === 0) throw new Error('Exercice introuvable');
  const exercice = exR.rows[0];
  const dateCloture = exercice.date_fin;

  // ─── 1. Provisions clients douteux ─────────────────────────────────────
  // Factures non payées dont la date d'émission est > 6 mois avant la clôture.
  try {
    const seuilDate = new Date(dateCloture);
    seuilDate.setMonth(seuilDate.getMonth() - 6);
    const r = await pool.query(`
      SELECT f.id, f.numero, f.date_emission, f.total_ttc, f.montant_paye,
             c.nom AS client_nom
        FROM factures f
        LEFT JOIN clients c ON c.id = f.client_id
       WHERE f.entreprise_id = $1
         AND f.type = 'facture'
         AND f.statut != 'annulee'
         AND f.statut != 'payee'
         AND f.date_emission < $2
         AND f.date_emission <= $3
         AND (f.total_ttc - COALESCE(f.montant_paye, 0)) > 0
    `, [entrepriseId, seuilDate.toISOString().slice(0,10), dateCloture]);

    if (r.rows.length > 0) {
      const total = r.rows.reduce((s, f) => s + (parseFloat(f.total_ttc) - parseFloat(f.montant_paye || 0)), 0);
      suggestions.push({
        id: 'provisions-clients-douteux',
        type: 'provision',
        titre: 'Dotation aux provisions pour créances douteuses',
        explication: `${r.rows.length} facture(s) impayée(s) depuis plus de 6 mois, pour un encours total de ${Math.round(total).toLocaleString('fr-FR')} FCFA. Dotation suggérée à 100% par prudence.`,
        details: r.rows.slice(0, 10).map(f => ({
          numero: f.numero,
          client: f.client_nom,
          date: f.date_emission,
          encours: parseFloat(f.total_ttc) - parseFloat(f.montant_paye || 0),
        })),
        ecriture: {
          date: dateCloture,
          libelle: 'Dotation provisions créances douteuses (exercice ' + String(dateCloture).slice(0, 4) + ')',
          lignes: [
            { compte: '6817', libelle: 'Dotations aux provisions pour créances douteuses', debit: Math.round(total), credit: 0 },
            { compte: '491',  libelle: 'Provisions pour créances douteuses', debit: 0, credit: Math.round(total) },
          ],
        },
      });
    }
  } catch (err) {
    console.warn('Suggestion provisions douteux échouée:', err.message);
  }

  // ─── 2. Régularisation TVA ─────────────────────────────────────────────
  // Solde de la TVA collectée (44571) - TVA déductible (44566 + 44562).
  // Si > 0 : TVA à reverser au Trésor. Si < 0 : crédit de TVA à reporter.
  try {
    const balance = await chargerBalance(entrepriseId, exerciceId);
    const tvaCollectee  = sommeSolde(balance, ['44571'], 'C');
    const tvaDeductible = sommeSolde(balance, ['44566','44562'], 'D');
    const aReverser     = tvaCollectee - tvaDeductible;

    if (Math.abs(aReverser) > EPS) {
      if (aReverser > 0) {
        suggestions.push({
          id: 'tva-a-reverser',
          type: 'tva',
          titre: 'TVA à reverser au Trésor public',
          explication: `Solde TVA collectée (44571) = ${Math.round(tvaCollectee).toLocaleString('fr-FR')} FCFA, TVA déductible = ${Math.round(tvaDeductible).toLocaleString('fr-FR')} FCFA. Net à reverser = ${Math.round(aReverser).toLocaleString('fr-FR')} FCFA.`,
          ecriture: {
            date: dateCloture,
            libelle: 'Régularisation TVA exercice ' + String(dateCloture).slice(0, 4),
            lignes: [
              { compte: '44571', libelle: 'TVA collectée (apurement)', debit: Math.round(tvaCollectee), credit: 0 },
              { compte: '44566', libelle: 'TVA déductible (apurement)', debit: 0, credit: Math.round(tvaDeductible) },
              { compte: '44551', libelle: 'État, TVA due', debit: 0, credit: Math.round(aReverser) },
            ],
          },
        });
      } else {
        suggestions.push({
          id: 'tva-credit',
          type: 'tva',
          titre: 'Crédit de TVA à reporter',
          explication: `TVA déductible (${Math.round(tvaDeductible).toLocaleString('fr-FR')}) > TVA collectée (${Math.round(tvaCollectee).toLocaleString('fr-FR')}). Crédit de ${Math.round(-aReverser).toLocaleString('fr-FR')} FCFA à reporter sur l'exercice suivant.`,
          ecriture: {
            date: dateCloture,
            libelle: 'Crédit TVA exercice ' + String(dateCloture).slice(0, 4),
            lignes: [
              { compte: '44571', libelle: 'TVA collectée (apurement)', debit: Math.round(tvaCollectee), credit: 0 },
              { compte: '4449',  libelle: 'État, crédit de TVA à reporter', debit: Math.round(-aReverser), credit: 0 },
              { compte: '44566', libelle: 'TVA déductible (apurement)', debit: 0, credit: Math.round(tvaDeductible) },
            ],
          },
        });
      }
    }
  } catch (err) {
    console.warn('Suggestion TVA échouée:', err.message);
  }

  // ─── 3. Comptes d'attente non soldés (471/472) ─────────────────────────
  try {
    const balance = await chargerBalance(entrepriseId, exerciceId);
    const attenteD = sommeSolde(balance, ['471','472','475','476'], 'D');
    const attenteC = sommeSolde(balance, ['471','472','475','476'], 'C');
    if (attenteD > EPS || attenteC > EPS) {
      suggestions.push({
        id: 'comptes-attente',
        type: 'alerte',
        titre: 'Comptes d\'attente non soldés',
        explication: `Comptes 47x présentent un solde au ${String(dateCloture).slice(0,10)} : ${Math.round(attenteD).toLocaleString('fr-FR')} FCFA débiteur, ${Math.round(attenteC).toLocaleString('fr-FR')} FCFA créditeur. À analyser et reclasser manuellement avant clôture (suspens bancaire, opérations à imputer…).`,
        ecriture: null, // pas d'écriture auto possible — alerte uniquement
      });
    }
  } catch (err) {
    console.warn('Suggestion comptes attente échouée:', err.message);
  }

  return suggestions;
}

function sommeSolde(balance, prefixes, sens) {
  let total = 0;
  for (const [num, sol] of balance) {
    if (prefixes.some(p => num.startsWith(p))) {
      total += sens === 'D' ? sol.solde_debiteur : sol.solde_crediteur;
    }
  }
  return total;
}

/**
 * Enregistre en lot les écritures sélectionnées dans le journal d'OD
 * (Opérations Diverses). Retourne le nombre d'écritures créées.
 */
async function enregistrerSuggestions(entrepriseId, exerciceId, userId, suggestionsAEnregistrer) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Trouve un journal d'OD pour l'entreprise
    const jR = await client.query(
      `SELECT id FROM journaux WHERE entreprise_id = $1 AND code = 'OD' LIMIT 1`,
      [entrepriseId]
    );
    if (jR.rows.length === 0) {
      throw new Error('Journal d\'Opérations Diverses (OD) introuvable. Créez-le d\'abord.');
    }
    const journalId = jR.rows[0].id;

    // Récupère le prochain numéro de pièce OD (max + 1)
    const dernR = await client.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(numero_piece FROM 'OD([0-9]+)') AS INTEGER)), 0) AS dernier
         FROM ecritures
        WHERE entreprise_id = $1 AND journal_id = $2 AND numero_piece ~ '^OD[0-9]+$'`,
      [entrepriseId, journalId]
    );
    let prochainNum = parseInt(dernR.rows[0].dernier) + 1;

    let count = 0;
    for (const sugg of suggestionsAEnregistrer) {
      if (!sugg.ecriture) continue;

      const numeroPiece = `OD${String(prochainNum).padStart(5, '0')}`;
      prochainNum++;

      // Crée l'écriture
      const ecR = await client.query(
        `INSERT INTO ecritures
           (entreprise_id, exercice_id, journal_id, numero_piece, date_ecriture, libelle, origine, validee, cree_par)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
         RETURNING id`,
        [entrepriseId, exerciceId, journalId, numeroPiece, sugg.ecriture.date, sugg.ecriture.libelle, 'cloture_auto', userId]
      );
      const ecritureId = ecR.rows[0].id;

      // Crée les lignes. Récupère l'UUID du compte depuis plan_comptable
      // (compte_id NOT NULL). Si le compte n'existe pas, on le crée minimal.
      let ordre = 1;
      for (const ligne of sugg.ecriture.lignes) {
        let cR = await client.query(
          `SELECT id FROM plan_comptable WHERE entreprise_id = $1 AND numero = $2`,
          [entrepriseId, ligne.compte]
        );
        let compteId;
        if (cR.rows.length > 0) {
          compteId = cR.rows[0].id;
        } else {
          // Crée le compte manquant à la volée. Nature déduite de la classe :
          //   6 → CHARGE, 7 → PRODUIT, 8 → HAO, autres → ACTIF (par défaut)
          //   Pour 4 (tiers) et 5 (trésorerie), la nature dépend du sens
          //   du solde. ACTIF par défaut, l'EC pourra ajuster.
          const classe = parseInt(ligne.compte.charAt(0));
          const nature = classe === 6 ? 'CHARGE'
                       : classe === 7 ? 'PRODUIT'
                       : classe === 8 ? 'HAO'
                       : 'ACTIF';
          const newC = await client.query(
            `INSERT INTO plan_comptable (entreprise_id, numero, libelle, classe, nature)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [entrepriseId, ligne.compte, ligne.libelle, classe, nature]
          );
          compteId = newC.rows[0].id;
        }
        await client.query(
          `INSERT INTO lignes_ecriture
             (ecriture_id, compte_id, compte_numero, libelle, debit, credit, ordre)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [ecritureId, compteId, ligne.compte, ligne.libelle, ligne.debit, ligne.credit, ordre++]
        );
      }
      count++;
    }

    await client.query('COMMIT');
    return count;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { genererSuggestionsCloture, enregistrerSuggestions };
