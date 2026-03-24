const pool = require('../../config/database');
const { body } = require('express-validator');

const factureRules = [
  body('client_id').notEmpty().withMessage('Client requis').isUUID().withMessage('Client invalide'),
  body('type').optional().isIn(['facture','devis','avoir','proforma']).withMessage('Type invalide'),
  body('taux_tva').optional().isFloat({ min: 0, max: 100 }).withMessage('TVA invalide'),
  body('lignes').isArray({ min: 1 }).withMessage('Au moins une ligne requise'),
  body('lignes.*.description').notEmpty().withMessage('Description ligne requise'),
  body('lignes.*.prix_unitaire').isFloat({ min: 0 }).withMessage('Prix unitaire invalide'),
  body('lignes.*.quantite').optional().isFloat({ min: 0.001 }).withMessage('Quantité invalide'),
  body('lignes.*.remise').optional().isFloat({ min: 0, max: 100 }).withMessage('Remise invalide (0-100)'),
];

const paiementRules = [
  body('montant').isFloat({ min: 0.01 }).withMessage('Montant invalide'),
  body('mode_paiement').optional().isIn(['cash','virement','cheque','mobile_money','carte']),
];

// GET /api/factures
const getFactures = async (req, res) => {
  try {
    const { statut, client_id, search, type, page = 1, limit = 20, date_debut, date_fin } = req.query;
    const eid = req.entrepriseId;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    await pool.query(
      `UPDATE factures SET statut='retard', updated_at=NOW()
       WHERE entreprise_id=$1 AND statut='en_attente' AND date_echeance < CURRENT_DATE`,
      [eid]
    );

    let query = `
      SELECT f.*, c.nom AS client_nom, c.code AS client_code, c.email AS client_email
      FROM factures f
      LEFT JOIN clients c ON c.id = f.client_id
      WHERE f.entreprise_id = $1
    `;
    const params = [eid];

    if (statut) { params.push(statut); query += ` AND f.statut=$${params.length}`; }
    if (type) { params.push(type); query += ` AND f.type=$${params.length}`; }
    if (client_id) { params.push(client_id); query += ` AND f.client_id=$${params.length}`; }
    if (date_debut) { params.push(date_debut); query += ` AND f.date_emission>=$${params.length}`; }
    if (date_fin) { params.push(date_fin); query += ` AND f.date_emission<=$${params.length}`; }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (f.numero ILIKE $${params.length} OR c.nom ILIKE $${params.length})`;
    }

    const countQuery = query.replace(
      'SELECT f.*, c.nom AS client_nom, c.code AS client_code, c.email AS client_email',
      'SELECT COUNT(*)'
    );
    const countRes = await pool.query(countQuery, params);

    query += ` ORDER BY f.date_emission DESC, f.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countRes.rows[0].count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Erreur getFactures:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/factures/:id
const getFactureById = async (req, res) => {
  try {
    const { id } = req.params;
    const factureRes = await pool.query(
      `SELECT f.*,
        c.nom AS client_nom, c.email AS client_email, c.telephone AS client_telephone,
        c.adresse AS client_adresse, c.ville AS client_ville, c.ninea AS client_ninea,
        e.nom AS entreprise_nom, e.adresse AS entreprise_adresse, e.ville AS entreprise_ville,
        e.telephone AS entreprise_tel, e.ninea AS entreprise_ninea, e.rccm AS entreprise_rccm
       FROM factures f
       LEFT JOIN clients c ON c.id = f.client_id
       LEFT JOIN entreprises e ON e.id = f.entreprise_id
       WHERE f.id=$1 AND f.entreprise_id=$2`,
      [id, req.entrepriseId]
    );
    if (factureRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Facture introuvable' });
    }
    const lignes = await pool.query('SELECT * FROM lignes_facture WHERE facture_id=$1 ORDER BY ordre', [id]);
    const paiements = await pool.query('SELECT * FROM paiements WHERE facture_id=$1 ORDER BY date_paiement DESC', [id]);
    res.json({ success: true, data: { ...factureRes.rows[0], lignes: lignes.rows, paiements: paiements.rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/factures
const createFacture = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eid = req.entrepriseId;
    const {
      client_id, type = 'facture', date_emission, date_echeance,
      lignes = [], taux_tva = 18, notes, conditions_paiement,
    } = req.body;

    // Vérifier que le client appartient à cette entreprise
    const clientCheck = await client.query(
      'SELECT id FROM clients WHERE id=$1 AND entreprise_id=$2 AND actif=true',
      [client_id, eid]
    );
    if (clientCheck.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Client introuvable ou inactif' });
    }

    // Numéro auto — LOCK TABLE pour éviter les doublons concurrents (pas de FOR UPDATE sur COUNT)
    await client.query('LOCK TABLE factures IN SHARE ROW EXCLUSIVE MODE');
    const year = new Date().getFullYear();
    const countRes = await client.query(
      `SELECT COUNT(*) FROM factures WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM date_emission)=$2`,
      [eid, year]
    );
    const prefix = type === 'devis' ? 'D' : type === 'avoir' ? 'AV' : type === 'proforma' ? 'PRO' : 'F';
    const numero = `${prefix}-${year}-${String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0')}`;

    // Calcul totaux
    let sous_total = 0;
    for (const l of lignes) {
      const remise = Math.min(100, Math.max(0, parseFloat(l.remise) || 0));
      sous_total += (parseFloat(l.quantite) || 1) * (parseFloat(l.prix_unitaire) || 0) * (1 - remise / 100);
    }
    const tvaNorm = Math.min(100, Math.max(0, parseFloat(taux_tva)));
    const montant_tva = sous_total * (tvaNorm / 100);
    const total_ttc = sous_total + montant_tva;

    const factureRes = await client.query(
      `INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
        date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, notes, conditions_paiement)
       VALUES ($1,$2,$3,$4,$5,'brouillon',$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        eid, client_id, req.user.id, numero, type,
        date_emission || new Date().toISOString().split('T')[0],
        date_echeance || null,
        Math.round(sous_total * 100) / 100, tvaNorm,
        Math.round(montant_tva * 100) / 100,
        Math.round(total_ttc * 100) / 100,
        notes || null, conditions_paiement || 'Paiement à 30 jours',
      ]
    );
    const facture = factureRes.rows[0];

    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      const remise = Math.min(100, Math.max(0, parseFloat(l.remise) || 0));
      const qte = parseFloat(l.quantite) || 1;
      const pu = parseFloat(l.prix_unitaire) || 0;
      const total = Math.round(qte * pu * (1 - remise / 100) * 100) / 100;
      await client.query(
        `INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [facture.id, l.description.trim(), qte, l.unite || 'unité', pu, remise, total, i]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: facture });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur createFacture:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// PUT /api/factures/:id/statut
const updateStatut = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;
    const valid = ['brouillon', 'envoyee', 'payee', 'en_attente', 'retard', 'annulee'];
    if (!valid.includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide' });
    }
    const result = await pool.query(
      'UPDATE factures SET statut=$1, updated_at=NOW() WHERE id=$2 AND entreprise_id=$3 RETURNING *',
      [statut, id, req.entrepriseId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Facture introuvable' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/factures/:id/paiement
const addPaiement = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { montant, date_paiement, mode_paiement = 'virement', reference, notes } = req.body;

    const factureRes = await client.query(
      'SELECT * FROM factures WHERE id=$1 AND entreprise_id=$2 FOR UPDATE',
      [id, req.entrepriseId]
    );
    if (factureRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Facture introuvable' });
    }
    const facture = factureRes.rows[0];

    if (facture.statut === 'annulee') {
      return res.status(400).json({ success: false, message: 'Impossible de payer une facture annulée' });
    }

    const montantNum = Math.round(parseFloat(montant) * 100) / 100;
    const nouveauPaye = Math.round((parseFloat(facture.montant_paye) + montantNum) * 100) / 100;
    const ttc = parseFloat(facture.total_ttc);

    if (nouveauPaye > ttc + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Montant dépasse le total TTC (${ttc} FCFA)`,
      });
    }

    await client.query(
      `INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference, notes)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, montantNum, date_paiement || new Date().toISOString().split('T')[0],
       mode_paiement, reference || null, notes || null]
    );

    const nouveauStatut = nouveauPaye >= ttc - 0.01 ? 'payee' : 'en_attente';
    await client.query(
      'UPDATE factures SET montant_paye=$1, statut=$2, updated_at=NOW() WHERE id=$3',
      [nouveauPaye, nouveauStatut, id]
    );

    await client.query('COMMIT');
    res.json({ success: true, statut: nouveauStatut, montant_paye: nouveauPaye });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur addPaiement:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// DELETE /api/factures/:id
const deleteFacture = async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM factures WHERE id=$1 AND entreprise_id=$2 AND statut='brouillon' RETURNING id`,
      [req.params.id, req.entrepriseId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture introuvable ou non supprimable (brouillons uniquement)',
      });
    }
    res.json({ success: true, message: 'Facture supprimée' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = { getFactures, getFactureById, createFacture, updateStatut, addPaiement, deleteFacture, factureRules, paiementRules };