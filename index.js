require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { loadEnvironmentVariables, validateEnvironmentVariables } = require('./config/dotenv');

// IMPORT DES ROUTES
const tripRoutes = require('./routes/tripRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const authRoutes = require('./routes/authRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const messageRoutes = require('./routes/messageRoutes');
const adminRoutes = require("./routes/adminRoutes");

// SERVICES ET MIDDLEWARES
const { httpRequestsTotal, httpDurationHistogram } = require('./services/metricsServices');
const { 
  errorHandler, 
  notFoundHandler, 
  setupProcessErrorHandlers 
} = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 5002;

console.log('🔥 Lancement du serveur...');

// CONFIGURATION ENVIRONNEMENT

try {
  loadEnvironmentVariables();
  validateEnvironmentVariables();
  logger.info('✅ Variables d\'environnement chargées et validées');
} catch (error) {
  logger.error('❌ Erreur lors du chargement des variables d\'environnement:', error);
  process.exit(1);
}

// MIDDLEWARES DE SÉCURITÉ

// Protection des headers HTTP
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// Configuration CORS adaptée au MVP
const corsOptions = {
  origin: function (origin, callback) {
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    const allowedOrigins = process.env.CORS_ORIGIN ? 
      process.env.CORS_ORIGIN.split(',') : 
      ['http://localhost:3000', 'http://localhost:3001'];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400
};

app.use(cors(corsOptions));

// PARSING DES DONNÉES

const bodyLimit = process.env.MAX_REQUEST_BODY_SIZE || '1mb';

app.use(express.json({ 
  limit: bodyLimit, 
  strict: true,
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      const error = new Error('JSON invalide');
      error.statusCode = 400;
      throw error;
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: bodyLimit,
  parameterLimit: 20
}));

// RATE LIMITING ADAPTATIF

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    success: false,
    error: {
      type: 'RateLimitError',
      message: 'Trop de requêtes, veuillez réessayer plus tard',
      retryAfter: 15 * 60
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}-${req.get('User-Agent') || 'unknown'}`,
  skip: (req) => req.path === '/ping' || req.path === '/api/health'
});

app.use(globalLimiter);

// Rate limiting strict pour l'auth (anti-brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: {
      type: 'AuthRateLimitError',
      message: 'Trop de tentatives de connexion, réessayez dans 15 minutes',
      retryAfter: 15 * 60
    }
  },
  skipSuccessfulRequests: true
});

// MIDDLEWARE DE MÉTRIQUES ET MONITORING

app.use((req, res, next) => {
  const start = process.hrtime();
  
  req.startTime = Date.now();

  if (process.env.NODE_ENV === 'development') {
    logger.info(`📥 ${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type')
    });
  }

  res.on('finish', () => {
    const duration = process.hrtime(start);
    const seconds = duration[0] + duration[1] / 1e9;
    const responseTime = Date.now() - req.startTime;

    httpRequestsTotal.inc({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    });

    httpDurationHistogram.observe({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    }, seconds);

    if (responseTime > 1000) {
      logger.warn(`🐌 Requête lente détectée: ${req.method} ${req.path}`, {
        responseTime: `${responseTime}ms`,
        statusCode: res.statusCode
      });
    }

    if (res.statusCode >= 500) {
      logger.error(`💥 Erreur serveur: ${req.method} ${req.path}`, {
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        ip: req.ip
      });
    }
  });

  next();
});

// ROUTES PRINCIPALES

// Routes métier avec prefixes API clairs
app.use('/api/roadtrips', tripRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

// Routes d'authentification avec rate limiting renforcé
app.use('/api/auth', authLimiter, authRoutes);

// Routes de monitoring (sans rate limiting)
app.use('/metrics', metricsRoutes);

// ROUTES DE SANTÉ ET STATUS

// Health check simple pour load balancers
app.get('/ping', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Health check détaillé avec vérifications
app.get('/api/health', async (req, res) => {
  const healthData = {
    status: 'healthy',
    service: 'data-service',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  };

  try {
    const dbState = mongoose.connection.readyState;
    healthData.database = {
      status: dbState === 1 ? 'connected' : 'disconnected',
      state: dbState
    };

    if (dbState !== 1) {
      healthData.status = 'unhealthy';
      return res.status(503).json(healthData);
    }

    res.status(200).json(healthData);
  } catch (error) {
    healthData.status = 'unhealthy';
    healthData.database = { status: 'error', error: error.message };
    res.status(503).json(healthData);
  }
});

// GESTION DES ROUTES NON TROUVÉES ET ERREURS

// Middleware pour capturer les routes 404
app.use(notFoundHandler);

// Middleware global de gestion d'erreurs (DOIT être en dernier)
app.use(errorHandler);

// CONNEXION À LA BASE DE DONNÉES

const mongoOptions = {
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '10', 10),
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  family: 4,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
  compressors: ['zlib'],
  maxIdleTimeMS: 30000,
  directConnection: false,
  readPreference: 'primary',
};

// FONCTION DE DÉMARRAGE

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI n\'est pas défini dans les variables d\'environnement');
    }

    logger.info('🔌 Connexion à MongoDB...');
    logger.info(`📍 URI: ${process.env.MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // URI masquée pour les logs
    
    await mongoose.connect(process.env.MONGO_URI, mongoOptions);
    
    logger.info('✅ Connexion à MongoDB réussie');
    logger.info(`📊 Pool de connexions: ${mongoOptions.maxPoolSize} max, ${mongoOptions.minPoolSize} min`);

    const dbName = mongoose.connection.name;
    logger.info(`🗄️ Base de données connectée: ${dbName}`);

    await mongoose.connection.db.admin().ping();
    logger.info('🏓 Ping MongoDB réussi');

    if (process.env.NODE_ENV === 'development') {
      try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        logger.info(`📚 Collections disponibles: ${collections.map(c => c.name).join(', ')}`);
      } catch (error) {
        logger.warn('⚠️ Impossible de lister les collections:', error.message);
      }
    }

    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Database service démarré sur http://localhost:${PORT}`);
      logger.info(`🌍 Environnement: ${process.env.NODE_ENV}`);
      logger.info(`📊 Métriques disponibles sur http://localhost:${PORT}/metrics`);
      logger.info(`🏥 Health check: http://localhost:${PORT}/api/health`);
    });

    server.setTimeout(parseInt(process.env.SERVER_TIMEOUT || '60000', 10));

    const gracefulShutdown = (signal) => {
      logger.info(`📴 Signal ${signal} reçu, arrêt gracieux...`);
      
      server.close(() => {
        logger.info('🔴 Serveur HTTP fermé');
        
        mongoose.connection.close(false, () => {
          logger.info('🔴 Connexion MongoDB fermée');
          process.exit(0);
        });
      });

      setTimeout(() => {
        logger.error('💀 Arrêt forcé après timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;

  } catch (error) {
    logger.error('❌ Erreur lors du démarrage du serveur:', error);
    
    if (error.message.includes('ECONNREFUSED')) {
      logger.error('💡 Solution: Vérifiez que MongoDB est démarré et accessible');
    } else if (error.message.includes('authentication failed')) {
      logger.error('💡 Solution: Vérifiez vos credentials MongoDB dans MONGO_URI');
    } else if (error.message.includes('option')) {
      logger.error('💡 Solution: Option MongoDB non supportée détectée');
    }
    
    if (process.env.NODE_ENV === 'development') {
      const retryDelay = 5000;
      logger.info(`🔄 Nouvelle tentative dans ${retryDelay/1000} secondes...`);
      setTimeout(startServer, retryDelay);
    } else {
      process.exit(1);
    }
  }
}

// GESTIONNAIRES D'ÉVÉNEMENTS MONGODB AMÉLIORÉS

// Surveillance de la connexion MongoDB
mongoose.connection.on('connected', () => {
  logger.info('🔗 Connexion MongoDB établie');
});

mongoose.connection.on('error', (error) => {
  logger.error('❌ Erreur MongoDB:', error);
  
  if (error.name === 'MongoParseError') {
    logger.error('💡 Erreur de configuration MongoDB détectée');
  } else if (error.name === 'MongoNetworkError') {
    logger.error('💡 Problème réseau avec MongoDB');
  }
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ Connexion MongoDB perdue');
});

mongoose.connection.on('reconnected', () => {
  logger.info('✅ Reconnexion MongoDB réussie');
});

mongoose.connection.on('close', () => {
  logger.info('🔒 Connexion MongoDB fermée');
});

// CONFIGURATION DE DEBUG POUR DÉVELOPPEMENT

if (process.env.NODE_ENV === 'development') {
  mongoose.set('debug', (collectionName, method, query, doc) => {
    logger.debug(`🔍 Mongoose: ${collectionName}.${method}`, {
      query: JSON.stringify(query),
      doc: doc ? JSON.stringify(doc) : undefined
    });
  });
}

// GESTION DES ERREURS GLOBALES

setupProcessErrorHandlers();

mongoose.connection.on('error', (error) => {
  logger.error('❌ Erreur MongoDB:', error);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ Connexion MongoDB perdue');
});

mongoose.connection.on('reconnected', () => {
  logger.info('✅ Reconnexion MongoDB réussie');
});

// LANCEMENT DE L'APPLICATION

// Démarrer le serveur uniquement si ce fichier est exécuté directement
if (require.main === module) {
  startServer();
}

module.exports = app;