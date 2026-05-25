/**
 * Middleware super-admin (migration 029).
 * À utiliser APRÈS auth() : vérifie req.user.is_super_admin === true.
 * Renvoie 403 sinon — pas de leak « cette route existe ».
 */
const pool = require('../../config/database');

async function requireSuperAdmin(req, res, next) {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, message: 'Non authentifié' });
    let r;
    try {
      r = await pool.query('SELECT is_super_admin FROM utilisateurs WHERE id = $1', [req.user.id]);
    } catch (err) {
      // 42703 = colonne inexistante (migration 029 non appliquée)
      if (err.code === '42703') {
        return res.status(403).json({ success: false, message: 'Console admin indisponible (migration manquante)' });
      }
      throw err;
    }
    if (!r.rows[0]?.is_super_admin) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    next();
  } catch (err) {
    console.error('Erreur requireSuperAdmin:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

module.exports = { requireSuperAdmin };
