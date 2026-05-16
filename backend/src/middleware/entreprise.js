const pool = require('../../config/database');
const { peut, ALL_ROLES } = require('../utils/permissions');

/**
 * Résolution de l'entreprise + chargement du rôle du membre.
 * Retourne { ok: true, membre } ou { ok: false, status, message } pour
 * pouvoir partager la logique entre entrepriseAccess() et requirePermission().
 */
async function resoudreMembre(req) {
  // Source possible : header X-Entreprise-Id, ou paramètre de route :entrepriseId / :id
  // (sur les routes /entreprises/:id/* le param se nomme id et désigne déjà l'entreprise)
  const entrepriseId =
    req.headers['x-entreprise-id'] ||
    req.params.entrepriseId ||
    req.params.id;

  if (!entrepriseId) {
    return { ok: false, status: 400, message: 'Entreprise non spécifiée (header X-Entreprise-Id requis)' };
  }

  // Valider que c'est bien un UUID pour éviter toute injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(entrepriseId)) {
    return { ok: false, status: 400, message: 'Identifiant entreprise invalide' };
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
    return { ok: false, status: 403, message: 'Accès refusé à cette entreprise' };
  }

  return { ok: true, entrepriseId, membre: result.rows[0] };
}

/**
 * Injecte req.entreprise, req.entrepriseId, req.roleEntreprise sur req.
 */
function attacherContexte(req, res, entrepriseId, membre) {
  req.entreprise = membre;
  req.entrepriseId = entrepriseId;
  req.roleEntreprise = membre.role;
}

/**
 * Middleware historique : vérifie que l'utilisateur a accès à l'entreprise
 * et que son rôle figure dans la liste autorisée.
 *
 * Conservé pour rétrocompatibilité avec les routes existantes (ea, eaWrite,
 * eaAdmin, eaPaie...). Préférer requirePermission(module, action) pour les
 * nouvelles routes.
 */
const entrepriseAccess = (rolesAutorises = ALL_ROLES) => {
  return async (req, res, next) => {
    try {
      const result = await resoudreMembre(req);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, message: result.message });
      }
      const { entrepriseId, membre } = result;
      if (!rolesAutorises.includes(membre.role)) {
        return res.status(403).json({
          success: false,
          message: `Permissions insuffisantes. Requis : ${rolesAutorises.join(', ')}`,
        });
      }
      attacherContexte(req, res, entrepriseId, membre);
      next();
    } catch (err) {
      console.error('Erreur middleware entreprise:', err.message);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  };
};

/**
 * Nouveau middleware : vérifie que le rôle du membre a la permission
 * (module, action) selon la matrice centrale `utils/permissions.js`.
 *
 * Usage :
 *   router.post('/factures', auth, requirePermission('factures', 'create'), createFacture);
 */
const requirePermission = (module, action) => {
  return async (req, res, next) => {
    try {
      const result = await resoudreMembre(req);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, message: result.message });
      }
      const { entrepriseId, membre } = result;
      if (!peut(membre.role, module, action)) {
        return res.status(403).json({
          success: false,
          message: `Permission refusée : action « ${action} » sur le module « ${module} » non autorisée pour le rôle « ${membre.role} ».`,
          module, action, role: membre.role,
        });
      }
      attacherContexte(req, res, entrepriseId, membre);
      next();
    } catch (err) {
      console.error('Erreur middleware permission:', err.message);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  };
};

module.exports = entrepriseAccess;
module.exports.entrepriseAccess = entrepriseAccess;
module.exports.requirePermission = requirePermission;
