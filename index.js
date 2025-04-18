const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Importer la configuration des variables d'environnement
const { 
  loadEnvironmentVariables, 
  validateEnvironmentVariables 
} = require('./config/dotenv');

// Charger et valider les variables d'environnement
loadEnvironmentVariables();
validateEnvironmentVariables();

// Importer les routes
const userRoutes = require('./routes/userRoutes');
const tripRoutes = require('./routes/tripRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const aiRoutes = require('./routes/aiRoutes');
const oauthRoutes = require('./routes/oauthRoutes');

// Importer les middlewares
const errorHandler = require('./middlewares/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5002;

// Middlewares de sécurité et de configuration
app.use(helmet());

// Configuration CORS sécurisée
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Parser les requêtes JSON avec limite de taille
app.use(express.json({ 
  limit: process.env.MAX_REQUEST_BODY_SIZE || '1mb',
  strict: true  // Rejeter les payloads JSON malformés
}));

// Parser les requêtes URL-encoded
app.use(express.urlencoded({ 
  extended: true,
  limit: process.env.MAX_REQUEST_BODY_SIZE || '1mb'
}));

// Rate limiting pour prévenir les attaques par force brute
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limite de 100 requêtes par IP
//   message: 'Trop de requêtes, veuillez réessayer plus tard',
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use(limiter);

// Routes
app.use('/api/users', userRoutes);
app.use('/api/roadtrips', tripRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', oauthRoutes);


// Route de ping pour vérifier l'état du service
app.get('/ping', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString() 
  });
});

// Middleware de gestion des erreurs (doit être le dernier middleware)
app.use(errorHandler);

// Configuration des options MongoDB avec des valeurs par défaut sécurisées
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '10', 10),
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
};

// Connexion à MongoDB
mongoose.connect(process.env.MONGO_URI, mongoOptions)
.then(() => {
  logger.info('Connexion à MongoDB réussie');
  
  // Démarrer le serveur
  const server = app.listen(PORT, () => {
    logger.info(`Database service démarré sur le port ${PORT}`);
    logger.info(`Environnement: ${process.env.NODE_ENV}`);
  });

  // Gestion du timeout du serveur
  server.setTimeout(60000); // 60 secondes
})
.catch((error) => {
  logger.error('Erreur de connexion à MongoDB:', error);
  process.exit(1);
});

// Gestion des erreurs non catchées
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Gestion des exceptions non catchées
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;