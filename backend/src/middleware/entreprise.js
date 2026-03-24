const pool = require('../../config/database');

/**
 * Middleware : vérifie que l'utilisateur a accès à l'entreprise
 * L'entreprise_id vient soit du header X-Entreprise-Id, soit du param :entrepriseId
 * Injecte req.entreprise, req.entrepriseId et req.roleEntreprise
 */
const entrepriseAccess = (rolesAutorises = ['proprietaire', 'admin', 'comptable', 'user', 'lecture']) => {
  return async (req, res, next) => {
    try {
      const entrepriseId = req.headers['x-entreprise-id'] || req.params.entrepriseId;

      if (!entrepriseId) {
        return res.status(400).json({
          success: false,
          message: 'Entreprise non spécifiée (header X-Entreprise-Id requis)',
        });
      }

      // Valider que c'est bien un UUID pour éviter toute injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(entrepriseId)) {
        return res.status(400).json({ success: false, message: 'Identifiant entreprise invalide' });
      }

      const result = await pool.query(
        `SELECT me.role, e.id, e.nom, e.devise, e.taux_tva, e.pays, e.regime_fiscal
         FROM membres_entreprise me
         JOIN entreprises e ON e.id = me.entreprise_id
         WHERE me.utilisateur_id = $1
           AND me.entreprise_id = $2
           AND me.actif = true
           AND e.actif = true`,
        [req.user.id, entrepriseId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Accès refusé à cette entreprise' });
      }

      const membre = result.rows[0];

      if (!rolesAutorises.includes(membre.role)) {
        return res.status(403).json({
          success: false,
          message: `Permissions insuffisantes. Requis : ${rolesAutorises.join(', ')}`,
        });
      }

      req.entreprise = membre;
      req.entrepriseId = entrepriseId;
      req.roleEntreprise = membre.role;
      next();
    } catch (err) {
      console.error('Erreur middleware entreprise:', err.message);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  };
};

module.exports = entrepriseAccess;
