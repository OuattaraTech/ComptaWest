const jwt = require('jsonwebtoken');
const pool = require('../../config/database');

/**
 * Middleware d'authentification.
 * 1. Vérifie la signature et la validité du jeton JWT.
 * 2. Confirme en base que le compte existe toujours et est actif.
 * 3. Rejette les jetons révoqués (émis avant utilisateurs.tokens_invalides_avant).
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token manquant ou invalide' });
  }

  const token = authHeader.split(' ')[1];

  if (!token || token.length < 10) {
    return res.status(401).json({ success: false, message: 'Token malformé' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expirée, veuillez vous reconnecter' });
    }
    return res.status(401).json({ success: false, message: 'Token invalide' });
  }

  try {
    const result = await pool.query(
      'SELECT id, actif, tokens_invalides_avant FROM utilisateurs WHERE id = $1',
      [decoded.id]
    );
    const utilisateur = result.rows[0];

    if (!utilisateur || !utilisateur.actif) {
      return res.status(401).json({ success: false, message: 'Compte introuvable ou désactivé' });
    }

    // Révocation : un jeton émis avant l'horodatage de révocation est refusé.
    if (
      utilisateur.tokens_invalides_avant &&
      decoded.iat &&
      new Date(decoded.iat * 1000) < new Date(utilisateur.tokens_invalides_avant)
    ) {
      return res.status(401).json({ success: false, message: 'Session expirée, veuillez vous reconnecter' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error('Erreur middleware auth:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = authMiddleware;
