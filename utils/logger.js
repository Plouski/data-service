const winston = require('winston');
const path = require('path');

const { combine, timestamp, printf, json, colorize, errors, splat, simple } = winston.format;

// Format console personnalisé
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level}]: ${message} ${
    Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
  }`;
});

// Format général pour les logs
const logFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  splat(),
  json()
);

// Création du logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: process.env.SERVICE_NAME || 'generic-service' },
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(__dirname, '../logs/exceptions.log') })
  ],
  exitOnError: false
});

// Console uniquement en développement
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp(),
      consoleFormat
    )
  }));
}

// Méthodes utilitaires personnalisées
logger.logAuthEvent = (event, metadata = {}) => {
  logger.info(`Auth event: ${event}`, {
    auth_event: event,
    ...metadata,
    timestamp: new Date().toISOString()
  });
};

logger.logHttpRequest = (req, res, responseTime) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.headers['user-agent'],
    userId: req.user?.userId || 'anonymous',
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
  });
};

logger.logApiError = (req, error) => {
  logger.error('API Error', {
    method: req.method,
    url: req.url,
    userId: req.user?.userId || 'anonymous',
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    error: {
      message: error.message,
      stack: error.stack
    }
  });
};

logger.logRequest = (req) => {
  logger.info('Request Received', {
    method: req.method,
    path: req.path,
    body: req.body || 'No body',
    query: req.query || 'No query'
  });
};

logger.logDatabaseOperation = (operation, details) => {
  logger.info(`Database Operation: ${operation}`, details);
};

module.exports = logger;