// middlewares/serviceAuthMiddleware.js
const logger = require('../utils/logger');

/**
 * Middleware pour vérifier l'authentification de service à service
 * Vérifie que la requête contient une clé API valide pour les communications inter-services
 */
const serviceAuthMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    logger.warn('Tentative d\'accès sans clé API', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    return res.status(401).json({
      success: false,
      message: 'Authentification requise'
    });
  }
  
  // Vérifier si la clé API correspond à celle configurée
  if (apiKey !== process.env.SERVICE_API_KEY) {
    logger.warn('Tentative d\'accès avec une clé API invalide', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    return res.status(403).json({
      success: false,
      message: 'Clé API invalide'
    });
  }
  
  // La requête provient d'un service interne authentifié
  req.isServiceRequest = true;
  
  logger.debug('Service authentifié', {
    path: req.path,
    method: req.method
  });
  
  next();
};

module.exports = serviceAuthMiddleware;