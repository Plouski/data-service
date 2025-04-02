const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Configuration avancée de la connexion MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE, 10),
      // Options de performance et de stabilité
      serverSelectionTimeoutMS: 5000, // Timeout de sélection du serveur
      socketTimeoutMS: 45000, // Timeout de socket
      family: 4 // Forcer IPv4
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Configuration des options globales de Mongoose
    mongoose.set('debug', process.env.NODE_ENV === 'development');
    mongoose.set('strictQuery', true);

    return conn;
  } catch (error) {
    logger.error(`Erreur de connexion MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Gestion des événements de connexion
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connecté à la base de données');
});

mongoose.connection.on('error', (err) => {
  logger.error(`Erreur de connexion Mongoose: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Connexion Mongoose déconnectée');
});

module.exports = connectDB;