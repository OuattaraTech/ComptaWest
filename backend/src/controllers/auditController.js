const pool = require('../../config/database');

// Valeurs autorisées (filtrage côté client = défense en profondeur)
const ENTITES_VALIDES = ['factures', 'depenses', 'taxes', 'clients', 'membres', 'entreprises', 'auth'];
const ACTIONS_VALIDES = [
  'CREATE', 'UPDATE', 'DELETE', 'PAY',
  'LOGIN_OK', 'LOGIN_FAIL', 'INVITE', 'REVOKE', 'ROLE_CHANGE',
];

// GET /api/audit-log
const getAuditLog = async (req, res) => {
  try {
    const {
      entite, action, utilisateur_id, date_debut, date_fin,
      page = 1, limit = 50,
    } = req.query;
    const eid      = req.entrepriseId;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset   = (pageNum - 1) * limitNum;

    const conditions = ['a.entreprise_id = $1'];
    const params     = [eid];

    if (entite && ENTITES_VALIDES.includes(entite)) {
      params.push(entite); conditions.push(`a.entite = $${params.length}`);
    }
    if (action && ACTIONS_VALIDES.includes(action)) {
      params.push(action); conditions.push(`a.action = $${params.length}`);
    }
    if (utilisateur_id) {
      params.push(utilisateur_id); conditions.push(`a.utilisateur_id = $${params.length}`);
    }
    if (date_debut) {
      params.push(date_debut); conditions.push(`a.created_at >= $${params.length}`);
    }
    if (date_fin) {
      // Inclure toute la journée
      params.push(date_fin); conditions.push(`a.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const where = conditions.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM audit_log a WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await pool.query(
      `SELECT a.id, a.action, a.entite, a.entite_id, a.details,
              a.ip, a.user_agent, a.created_at,
              a.utilisateur_email, u.nom AS utilisateur_nom
       FROM audit_log a
       LEFT JOIN utilisateurs u ON u.id = a.utilisateur_id
       WHERE ${where}
       ORDER BY a.created_at DESC
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
      },
    });
  } catch (err) {
    console.error('Erreur getAuditLog:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = { getAuditLog };
