const pool = require('../../config/database');

/**
 * Enregistre une action dans audit_log.
 * Fire-and-forget : si l'insertion échoue, on log mais on ne fait pas échouer la requête.
 *
 * @param {object}  req            Express request (lit user, entrepriseId, ip, user-agent)
 * @param {string}  action         CREATE, UPDATE, DELETE, LOGIN_OK, LOGIN_FAIL, PAY, INVITE, REVOKE, ROLE_CHANGE...
 * @param {string}  entite         factures, depenses, taxes, clients, membres, auth...
 * @param {string?} entiteId       UUID de l'enregistrement concerné (nullable)
 * @param {object?} details        Payload libre (ex : { avant, apres } ou { email, role })
 */
const logAudit = (req, action, entite, entiteId = null, details = null) => {
  const userId    = req.user?.id || null;
  const userEmail = req.user?.email || details?.email || null;
  const eid       = req.entrepriseId || null;
  const ip        = (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.ip || null;
  const ua        = req.headers['user-agent'] || null;

  pool.query(
    `INSERT INTO audit_log
       (entreprise_id, utilisateur_id, utilisateur_email, action, entite, entite_id, details, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [eid, userId, userEmail, action, entite, entiteId, details ? JSON.stringify(details) : null, ip, ua]
  ).catch(err => {
    // Ne jamais faire échouer une requête métier à cause d'un échec d'audit
    console.error('[audit_log] échec insertion:', err.message);
  });
};

module.exports = { logAudit };
