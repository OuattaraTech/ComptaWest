const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token manquant ou invalide' });
  }

  const token = authHeader.split(' ')[1];

  if (!token || token.length < 10) {
    return res.status(401).json({ success: false, message: 'Token malformé' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expirée, veuillez vous reconnecter' });
    }
    return res.status(401).json({ success: false, message: 'Token invalide' });
  }
};

module.exports = authMiddleware;
