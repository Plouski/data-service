const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    // Récupérer le token depuis l'en-tête Authorization
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({ 
        message: 'Aucun token d\'authentification fourni' 
      });
    }

    // Vérifier le format du token (Bearer TOKEN)
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ 
        message: 'Format de token invalide' 
      });
    }

    const token = parts[1];

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Vérifier si l'utilisateur existe encore
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        message: 'Utilisateur non trouvé' 
      });
    }

    // Ajouter l'utilisateur à l'objet de requête
    req.user = {
      id: user._id,
      email: user.email,
      role: user.role
    };

    // Journaliser l'accès
    logger.info(`Authentification réussie pour ${user.email}`);

    next();
  } catch (error) {
    logger.error('Erreur d\'authentification', error);

    // Gestion des erreurs spécifiques du token
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Token invalide' 
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expiré' 
      });
    }

    // Erreur générique
    res.status(401).json({ 
      message: 'Non autorisé',
      error: error.message 
    });
  }
};

// Middleware pour vérifier les rôles
const checkRole = (roles) => {
  return (req, res, next) => {
    // Vérifier si l'utilisateur a un rôle autorisé
    if (!roles.includes(req.user.role)) {
      logger.warn(`Tentative d'accès non autorisée - Rôle: ${req.user.role}`);
      return res.status(403).json({ 
        message: 'Accès refusé. Privilèges insuffisants.' 
      });
    }
    next();
  };
};

// Middleware de génération de token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id, 
      email: user.email,
      role: user.role 
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: '24h' // Expiration du token
    }
  );
};

module.exports = {
  authMiddleware,
  checkRole,
  generateToken
};