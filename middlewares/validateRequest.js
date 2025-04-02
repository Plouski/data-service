const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const validateRequest = (req, res, next) => {
  // Log pour vérifier la valeur de l'email avant validation
  console.log('Email reçu dans la requête (avant validation):', req.body.email);  // Utilisation de req.body.email
  console.log('Corps de la requête reçu:', req.body);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    logger.warn('Erreurs de validation des requêtes', {
      errors: errors.array(),
      method: req.method,
      path: req.path,
      body: req.body
    });

    return res.status(400).json({
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }

  next();
};

module.exports = validateRequest;
