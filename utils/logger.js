const winston = require('winston');
const path = require('path');

// Configuration des formats de log
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Créer un logger Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'database-service' },
  transports: [
    // Console pour development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // Fichier pour les logs d'erreur
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Fichier pour tous les logs
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Si on est en production, ne loguer que dans les fichiers
if (process.env.NODE_ENV === 'production') {
  logger.remove(logger.transports.find(t => t.name === 'console'));
}

// Méthodes d'extension pour des logs plus spécifiques
logger.logRequest = (req) => {
  logger.info('Request Received', {
    method: req.method,
    path: req.path,
    body: req.body ? JSON.stringify(req.body) : 'No body',
    query: req.query ? JSON.stringify(req.query) : 'No query'
  });
};

logger.logDatabaseOperation = (operation, details) => {
  logger.info(`Database Operation: ${operation}`, details);
};

module.exports = logger;