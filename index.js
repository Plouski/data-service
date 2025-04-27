require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { loadEnvironmentVariables, validateEnvironmentVariables } = require('./config/dotenv');
const userRoutes = require('./routes/userRoutes');
const tripRoutes = require('./routes/tripRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const aiRoutes = require('./routes/aiRoutes');
const oauthRoutes = require('./routes/oauthRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const { httpRequestsTotal, httpDurationHistogram } = require('./services/metricsServices');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 5002;

console.log('🔥 Lancement du serveur...');

// ───────────── Charger et valider .env ─────────────
loadEnvironmentVariables();
validateEnvironmentVariables();

// ───────────── Middlewares globaux ─────────────
app.use(helmet());

const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json({ limit: process.env.MAX_REQUEST_BODY_SIZE || '1mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_REQUEST_BODY_SIZE || '1mb' }));

// ───────────── Rate Limiting (optionnel) ─────────────
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: 'Trop de requêtes, veuillez réessayer plus tard',
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use(limiter);

// ───────────── Metrics Middleware ─────────────
app.use((req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const duration = process.hrtime(start);
    const seconds = duration[0] + duration[1] / 1e9;

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
  });

  next();
});

// ───────────── Routes principales ─────────────
app.use('/api/users', userRoutes);
app.use('/api/roadtrips', tripRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', oauthRoutes);
app.use('/metrics', metricsRoutes);

app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ───────────── Middleware gestion erreurs ─────────────
app.use(errorHandler);

// ───────────── Connexion MongoDB + lancement serveur ─────────────
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '10', 10),
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

mongoose.connect(process.env.MONGO_URI, mongoOptions)
.then(() => {
  logger.info('✅ Connexion à MongoDB réussie');

  const server = app.listen(PORT, () => {
    logger.info(`🚀 Database service démarré sur http://localhost:${PORT}`);
    logger.info(`🌍 Environnement: ${process.env.NODE_ENV}`);
  });

  server.setTimeout(60000);
})
.catch((error) => {
  logger.error('❌ Erreur de connexion à MongoDB:', error);
  process.exit(1);
});

// ───────────── Gestion erreurs Node.js ─────────────
process.on('unhandledRejection', (reason) => {
  logger.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;
