const pool = require('../../config/database');
const { body } = require('express-validator');
const { logAudit } = require('../utils/audit');
const { ecriturePaiementTaxe, ecritureLiquidationTVA } = require('../utils/comptabilite-auto');
const { ComptaError } = require('../utils/comptabilite');

// ── Règles de validation ──────────────────────────────────────────────────
const taxeRules = [
  body('type_taxe').isIn(['TVA', 'IS', 'BIC', 'CNSS', 'CMU', 'IRVM', 'Patente', 'Autre']).withMessage('Type de taxe invalide'),
  body('periode_debut').isISO8601().withMessage('Période de début invalide'),
  body('periode_fin').isISO8601().withMessage('Période de fin invalide'),
  body('date_echeance').isISO8601().withMessage("Date d'échéance invalide"),
  body('montant_base').isFloat({ min: 0 }).withMessage('Montant de base invalide'),
  body('taux').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('Taux invalide'),
  body('montant_du').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Montant dû invalide'),
  body('organisme').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 80 }).withMessage('Organisme trop long'),
];

const paiementTaxeRules = [
  body('montant_paye').isFloat({ min: 0.01 }).withMessage('Montant payé invalide'),
  body('date_paiement').optional({ checkFalsy: true }).isISO8601().withMessage('Date de paiement invalide'),
  body('mode_paiement').optional().isIn(['cash', 'virement', 'cheque', 'mobile_money', 'carte']).withMessage('Mode de paiement invalide'),
];

// Taux légaux Côte d'Ivoire (actualisables)
const TAUX_LEGAUX = {
  TVA: { taux: 18, organisme: 'DGI', echeance_jours: 20 },
  IS:  { taux: 25, organisme: 'DGI', echeance_jours: 120 },
  BIC: { taux: 20, organisme: 'DGI', echeance_jours: 120 },
  CNSS: { taux: 14, organisme: 'CNSS', echeance_jours: 15 },  // part patronale
  CMU:  { taux: 3.5, organisme: 'CNSS', echeance_jours: 15 },
  IRVM: { taux: 15, organisme: 'DGI', echeance_jours: 30 },
  Patente: { taux: 0.5, organisme: 'DGI', echeance_jours: 90 },
};

// GET /api/taxes — liste des déclarations
const getTaxes = async (req, res) => {
  try {
    const { statut, type_taxe, annee, page = 1, limit = 20 } = req.query;
    const eid = req.entrepriseId;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const offset   = (pageNum - 1) * limitNum;

    // Marquer automatiquement les déclarations en retard
    await pool.query(`
      UPDATE declarations_taxes SET statut='en_retard'
      WHERE entreprise_id=$1 AND statut='a_payer' AND date_echeance < CURRENT_DATE
    `, [eid]);

    const conditions = ['t.entreprise_id = $1'];
    const params     = [eid];

    if (statut)    { params.push(statut);    conditions.push(`t.statut = $${params.length}`); }
    if (type_taxe) { params.push(type_taxe); conditions.push(`t.type_taxe = $${params.length}`); }
    if (annee)     { params.push(annee);     conditions.push(`EXTRACT(YEAR FROM t.periode_fin) = $${params.length}`); }

    const where = conditions.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM declarations_taxes t WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await pool.query(
      `SELECT t.*, u.nom AS cree_par_nom
       FROM declarations_taxes t
       LEFT JOIN utilisateurs u ON u.id = t.cree_par
       WHERE ${where}
       ORDER BY t.date_echeance ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        total,
        page:  pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      }
    });
  } catch (err) {
    console.error('Erreur getTaxes:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/taxes/tableau-de-bord — synthèse fiscale
const getTableauBordTaxes = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    const annee = req.query.annee || new Date().getFullYear();

    // Totaux par statut
    const totauxRes = await pool.query(`
      SELECT statut,
        COUNT(*) AS nb,
        COALESCE(SUM(montant_du), 0) AS total_du,
        COALESCE(SUM(montant_paye), 0) AS total_paye
      FROM declarations_taxes
      WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM periode_fin)=$2
      GROUP BY statut
    `, [eid, annee]);

    // Totaux par type
    const parTypeRes = await pool.query(`
      SELECT type_taxe, organisme,
        COUNT(*) AS nb,
        COALESCE(SUM(montant_du), 0) AS total_du,
        COALESCE(SUM(montant_paye), 0) AS total_paye
      FROM declarations_taxes
      WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM periode_fin)=$2
      GROUP BY type_taxe, organisme
      ORDER BY total_du DESC
    `, [eid, annee]);

    // Prochaines échéances (30 jours)
    const echeancesRes = await pool.query(`
      SELECT * FROM declarations_taxes
      WHERE entreprise_id=$1
        AND statut IN ('a_payer','en_retard')
        AND date_echeance <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY date_echeance ASC
      LIMIT 10
    `, [eid]);

    // Calcul automatique TVA à déclarer depuis les factures
    const tvaCollecteeRes = await pool.query(`
      SELECT COALESCE(SUM(
               CASE WHEN type = 'avoir' THEN -montant_tva ELSE montant_tva END
             ), 0) AS collectee
      FROM factures
      WHERE entreprise_id=$1
        AND type IN ('facture','avoir')
        AND statut IN ('payee','envoyee','en_attente','retard')
        AND EXTRACT(YEAR FROM date_emission)=$2
    `, [eid, annee]);

    const tvaDeductibleRes = await pool.query(`
      SELECT COALESCE(SUM(montant_tva), 0) AS deductible
      FROM depenses
      WHERE entreprise_id=$1
        AND EXTRACT(YEAR FROM date_depense)=$2
        AND statut='payee'
    `, [eid, annee]);

    const tvaCollectee = parseFloat(tvaCollecteeRes.rows[0].collectee);
    const tvaDeductible = parseFloat(tvaDeductibleRes.rows[0].deductible);

    // Synthèse
    const aPayerTotal = totauxRes.rows
      .filter(r => ['a_payer','en_retard'].includes(r.statut))
      .reduce((s, r) => s + parseFloat(r.total_du) - parseFloat(r.total_paye), 0);

    const enRetardTotal = totauxRes.rows
      .filter(r => r.statut === 'en_retard')
      .reduce((s, r) => s + parseFloat(r.total_du) - parseFloat(r.total_paye), 0);

    res.json({
      success: true,
      data: {
        synthese: {
          a_payer: aPayerTotal,
          en_retard: enRetardTotal,
          nb_en_retard: totauxRes.rows.find(r => r.statut === 'en_retard')?.nb || 0,
          tva_collectee: tvaCollectee,
          tva_deductible: tvaDeductible,
          tva_nette: tvaCollectee - tvaDeductible
        },
        par_type: parTypeRes.rows.map(r => ({
          ...r,
          total_du: parseFloat(r.total_du),
          total_paye: parseFloat(r.total_paye),
          reste: parseFloat(r.total_du) - parseFloat(r.total_paye)
        })),
        prochaines_echeances: echeancesRes.rows,
        taux_legaux: TAUX_LEGAUX
      }
    });
  } catch (err) {
    console.error('Erreur tableau bord taxes:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/taxes — créer une déclaration
// Pour la TVA : génère également l'écriture de liquidation (4431/4452 → 4441 ou
// 4449) afin que les soldes des comptes 4431 et 4452 soient remis à zéro après
// chaque déclaration. Sinon ils grossissent indéfiniment et la balance ment.
const createTaxe = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eid = req.entrepriseId;
    const {
      type_taxe, organisme, periode_debut, periode_fin,
      date_echeance, montant_base, taux, montant_du, notes
    } = req.body;

    const tauxLegal = TAUX_LEGAUX[type_taxe];
    const montantDu = montant_du || (parseFloat(montant_base) * (parseFloat(taux || tauxLegal?.taux || 0) / 100));

    const result = await client.query(
      `INSERT INTO declarations_taxes
        (entreprise_id, cree_par, type_taxe, organisme, periode_debut, periode_fin,
         date_echeance, montant_base, taux, montant_du, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [eid, req.user.id, type_taxe, organisme || tauxLegal?.organisme || '',
       periode_debut, periode_fin, date_echeance,
       parseFloat(montant_base) || 0, parseFloat(taux || tauxLegal?.taux || 0),
       montantDu, notes]
    );
    const taxe = result.rows[0];

    const ecLiquid = await ecritureLiquidationTVA(client, {
      entrepriseId: eid,
      utilisateurId: req.user.id,
      taxe,
    });

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'taxes', taxe.id, {
      type_taxe, periode_debut, periode_fin, montant_du: montantDu,
      ecriture_liquidation: ecLiquid?.numero_piece || null,
    });
    res.status(201).json({ success: true, data: taxe });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof ComptaError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('Erreur createTaxe:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// POST /api/taxes/:id/paiement — marquer comme payée
const payerTaxe = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { montant_paye, date_paiement, reference_paiement, mode_paiement = 'virement' } = req.body;

    const taxeRes = await client.query(
      'SELECT * FROM declarations_taxes WHERE id=$1 AND entreprise_id=$2 FOR UPDATE',
      [id, req.entrepriseId]
    );
    if (taxeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Déclaration introuvable' });
    }

    const taxe = taxeRes.rows[0];
    const nouveauPaye = parseFloat(taxe.montant_paye) + parseFloat(montant_paye);
    const nouveauStatut = nouveauPaye >= parseFloat(taxe.montant_du) ? 'payee' : 'a_payer';
    const datePaie = date_paiement || new Date().toISOString().split('T')[0];

    const result = await client.query(
      `UPDATE declarations_taxes SET
        montant_paye=$1, statut=$2, reference_paiement=$3, date_paiement=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [nouveauPaye, nouveauStatut, reference_paiement, datePaie, id]
    );

    // Génération auto de l'écriture de paiement
    await ecriturePaiementTaxe(client, {
      entrepriseId: req.entrepriseId,
      utilisateurId: req.user.id,
      taxe: { ...result.rows[0], date_paiement: datePaie },
      montant: parseFloat(montant_paye),
      modePaiement: mode_paiement,
    });

    await client.query('COMMIT');
    logAudit(req, 'PAY', 'taxes', id, {
      type_taxe: taxe.type_taxe, montant: parseFloat(montant_paye),
      total_paye: nouveauPaye, statut: nouveauStatut, reference_paiement,
    });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof ComptaError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('Erreur payerTaxe:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// POST /api/taxes/calculer-tva — calcul automatique TVA sur une période
const calculerTVA = async (req, res) => {
  try {
    const { periode_debut, periode_fin } = req.query;
    const eid = req.entrepriseId;

    const collecteeRes = await pool.query(`
      SELECT COALESCE(SUM(
               CASE WHEN type = 'avoir' THEN -montant_tva ELSE montant_tva END
             ), 0) AS total,
             COALESCE(SUM(
               CASE WHEN type = 'avoir' THEN -total_ttc ELSE total_ttc END
             ), 0) AS ca_ttc
      FROM factures
      WHERE entreprise_id=$1
        AND type IN ('facture','avoir')
        AND date_emission BETWEEN $2 AND $3
        AND statut NOT IN ('annulee','brouillon')
    `, [eid, periode_debut, periode_fin]);

    const deductibleRes = await pool.query(`
      SELECT COALESCE(SUM(montant_tva), 0) AS total,
             COALESCE(SUM(montant_ttc), 0) AS depenses_ttc
      FROM depenses
      WHERE entreprise_id=$1
        AND date_depense BETWEEN $2 AND $3
        AND statut='payee' AND taux_tva > 0
    `, [eid, periode_debut, periode_fin]);

    const collectee = parseFloat(collecteeRes.rows[0].total);
    const deductible = parseFloat(deductibleRes.rows[0].total);
    const nette = collectee - deductible;

    res.json({
      success: true,
      data: {
        periode: { debut: periode_debut, fin: periode_fin },
        tva_collectee: collectee,
        tva_deductible: deductible,
        tva_nette: nette,
        ca_ttc: parseFloat(collecteeRes.rows[0].ca_ttc),
        depenses_ttc: parseFloat(deductibleRes.rows[0].depenses_ttc),
        a_verser: nette > 0 ? nette : 0,
        credit_tva: nette < 0 ? Math.abs(nette) : 0,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  getTaxes, getTableauBordTaxes, createTaxe, payerTaxe, calculerTVA,
  taxeRules, paiementTaxeRules,
};
