const pool = require('../../config/database');
const { body } = require('express-validator');

const clientRules = [
  body('nom').trim().notEmpty().withMessage('Nom requis').isLength({ max: 150 }),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email invalide').normalizeEmail(),
  body('type').optional().isIn(['entreprise', 'particulier']).withMessage('Type invalide'),
];

// GET /api/clients
const getClients = async (req, res) => {
  try {
    const { search, actif = 'true', page = 1, limit = 20 } = req.query;
    const eid = req.entrepriseId;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const actifBool = actif !== 'false';

    let query = `
      SELECT c.*,
        COUNT(f.id) AS nb_factures,
        COALESCE(SUM(f.total_ttc), 0) AS ca_total,
        COALESCE(SUM(CASE WHEN f.statut IN ('en_attente','retard') THEN f.total_ttc - f.montant_paye ELSE 0 END), 0) AS encours
      FROM clients c
      LEFT JOIN factures f ON f.client_id = c.id
      WHERE c.entreprise_id = $1 AND c.actif = $2
    `;
    const params = [eid, actifBool];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (c.nom ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.code ILIKE $${params.length})`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM clients WHERE entreprise_id = $1 AND actif = $2`,
      [eid, actifBool]
    );

    query += ` GROUP BY c.id ORDER BY c.nom ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
    console.error('Erreur getClients:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/clients/:id
const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM clients WHERE id=$1 AND entreprise_id=$2',
      [id, req.entrepriseId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client introuvable' });
    }
    const factures = await pool.query(
      'SELECT id, numero, statut, date_emission, total_ttc, montant_paye FROM factures WHERE client_id=$1 ORDER BY date_emission DESC LIMIT 10',
      [id]
    );
    res.json({ success: true, data: { ...result.rows[0], factures: factures.rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/clients
const createClient = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eid = req.entrepriseId;
    const { nom, type, email, telephone, adresse, ville, pays, ninea, rccm, notes } = req.body;

    // Générer un code unique — on verrouille avec LOCK TABLE pour éviter les doublons concurrents
    await client.query('LOCK TABLE clients IN SHARE ROW EXCLUSIVE MODE');
    const countRes = await client.query(
      'SELECT COUNT(*) FROM clients WHERE entreprise_id=$1',
      [eid]
    );
    const code = `CLI-${String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0')}`;

    const result = await client.query(
      `INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays, ninea, rccm, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [eid, code, nom.trim(), type || 'entreprise', email || null, telephone || null,
       adresse || null, ville || null, pays || "Côte d'Ivoire", ninea || null, rccm || null, notes || null]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur createClient:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// PUT /api/clients/:id
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, type, email, telephone, adresse, ville, pays, ninea, rccm, notes, actif } = req.body;

    if (!nom || !nom.trim()) {
      return res.status(400).json({ success: false, message: 'Nom requis' });
    }

    const result = await pool.query(
      `UPDATE clients SET nom=$1, type=$2, email=$3, telephone=$4, adresse=$5, ville=$6,
        pays=$7, ninea=$8, rccm=$9, notes=$10, actif=$11, updated_at=NOW()
       WHERE id=$12 AND entreprise_id=$13 RETURNING *`,
      [nom.trim(), type || 'entreprise', email || null, telephone || null,
       adresse || null, ville || null, pays || "Côte d'Ivoire",
       ninea || null, rccm || null, notes || null, actif !== false,
       id, req.entrepriseId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client introuvable' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// DELETE /api/clients/:id (soft delete)
const deleteClient = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE clients SET actif=false, updated_at=NOW() WHERE id=$1 AND entreprise_id=$2 RETURNING id',
      [req.params.id, req.entrepriseId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Client introuvable' });
    }
    res.json({ success: true, message: 'Client archivé' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = { getClients, getClientById, createClient, updateClient, deleteClient, clientRules };