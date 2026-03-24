const { validationResult } = require('express-validator');

/**
 * Middleware de validation express-validator
 * À placer après les règles de validation dans les routes
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = validate;
