const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Déterminer le code de statut de l'erreur
  const statusCode = err.statusCode || 500;
  
  // Log détaillé de l'erreur
  logger.error('Erreur globale capturée', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path
  });

  // Réponse d'erreur adaptée à l'environnement
  const errorResponse = {
    message: err.message || 'Une erreur interne est survenue',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  // Types d'erreurs spécifiques
  if (err.name === 'ValidationError') {
    // Erreurs de validation Mongoose
    errorResponse.errors = Object.values(err.errors).map(e => e.message);
  }

  if (err.name === 'MongoError' && err.code === 11000) {
    // Erreurs de duplication (clé unique)
    errorResponse.message = 'Une ressource avec ces informations existe déjà';
  }

  // Envoyer la réponse d'erreur
  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;