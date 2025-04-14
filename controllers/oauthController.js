const User = require('../models/User');
const logger = require('../utils/logger');
const JwtConfig = require('../config/jwtConfig');

exports.handleGoogleOAuth = async (req, res) => {
  try {
    const { email, firstName, lastName, googleId } = req.body;

    if (!email || !googleId) {
      logger.error('Champs manquants pour Google OAuth', { email, googleId });
      return res.status(400).json({ message: 'Champs manquants pour Google OAuth' });
    }

    // Recherche de l'utilisateur par googleId OU par email comme fallback
    let user = await User.findOne({ 'oauth.googleId': googleId });
    if (!user) {
      logger.info(`Utilisateur avec googleId ${googleId} non trouvé, recherche par email ${email}`);
      user = await User.findOne({ email });
    }

    const isNewUser = !user;

    // Création de l'utilisateur AVANT la génération des tokens
    if (!user) {
      logger.info(`Création d'un nouvel utilisateur pour Google OAuth: ${email}`);
      user = await User.create({
        email,
        firstName,
        lastName,
        role: 'user',
        oauth: {
          provider: 'google',
          googleId
        }
      });
      
      // Vérification que l'utilisateur a bien été créé
      if (!user || !user._id) {
        logger.error('Échec de création d\'utilisateur Google OAuth');
        return res.status(500).json({ 
          message: 'Erreur lors de la création de l\'utilisateur' 
        });
      }
      
      logger.info(`Nouvel utilisateur Google OAuth créé avec ID: ${user._id}`);
    } else {
      logger.info(`Utilisateur Google OAuth existant trouvé: ${user._id}`);
      
      // Mise à jour des informations OAuth si nécessaire
      if (!user.oauth || !user.oauth.googleId) {
        logger.info(`Mise à jour des informations OAuth pour l'utilisateur: ${user._id}`);
        user.oauth = {
          ...user.oauth,
          provider: 'google',
          googleId
        };
        await user.save();
      }
    }

    // Maintenant que nous sommes sûrs que user existe, génération des tokens
    const accessToken = JwtConfig.generateAccessToken(user);
    const refreshToken = JwtConfig.generateRefreshToken(user);

    // Optionnel: stocker le refresh token dans la base de données
    user.refreshToken = refreshToken;
    await user.save();

    logger.info(`Authentification Google OAuth réussie pour: ${user._id}`);
    res.status(200).json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isNewUser,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Erreur OAuth Google', err);
    res.status(500).json({ message: 'Erreur lors du traitement OAuth Google' });
  }
};

exports.handleFacebookOAuth = async (req, res) => {
  try {
    const { email, firstName, lastName, facebookId } = req.body;

    if (!email || !facebookId) {
      logger.error('Champs manquants pour Facebook OAuth', { email, facebookId });
      return res.status(400).json({ message: 'Champs manquants pour Facebook OAuth' });
    }

    // Recherche de l'utilisateur par facebookId OU par email comme fallback
    let user = await User.findOne({ 'oauth.facebookId': facebookId });
    if (!user) {
      logger.info(`Utilisateur avec facebookId ${facebookId} non trouvé, recherche par email ${email}`);
      user = await User.findOne({ email });
    }

    const isNewUser = !user;

    // Création de l'utilisateur AVANT la génération des tokens
    if (!user) {
      logger.info(`Création d'un nouvel utilisateur pour Facebook OAuth: ${email}`);
      user = await User.create({
        email,
        firstName,
        lastName,
        role: 'user',
        oauth: {
          provider: 'facebook',
          facebookId
        }
      });
      
      // Vérification que l'utilisateur a bien été créé
      if (!user || !user._id) {
        logger.error('Échec de création d\'utilisateur Facebook OAuth');
        return res.status(500).json({ 
          message: 'Erreur lors de la création de l\'utilisateur' 
        });
      }
      
      logger.info(`Nouvel utilisateur Facebook OAuth créé avec ID: ${user._id}`);
    } else {
      logger.info(`Utilisateur Facebook OAuth existant trouvé: ${user._id}`);
      
      // Mise à jour des informations OAuth si nécessaire
      if (!user.oauth || !user.oauth.facebookId) {
        logger.info(`Mise à jour des informations OAuth pour l'utilisateur: ${user._id}`);
        user.oauth = {
          ...user.oauth,
          provider: 'facebook',
          facebookId
        };
        await user.save();
      }
    }

    // Maintenant que nous sommes sûrs que user existe, génération des tokens
    const accessToken = JwtConfig.generateAccessToken(user);
    const refreshToken = JwtConfig.generateRefreshToken(user);

    // Optionnel: stocker le refresh token dans la base de données
    user.refreshToken = refreshToken;
    await user.save();

    logger.info(`Authentification Facebook OAuth réussie pour: ${user._id}`);
    res.status(200).json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isNewUser,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Erreur OAuth Facebook', err);
    res.status(500).json({ message: 'Erreur lors du traitement OAuth Facebook' });
  }
};

exports.handleGithubOAuth = async (req, res) => {
  try {
    const { email, firstName, lastName, githubId } = req.body;

    if (!email || !githubId) {
      logger.error('Champs manquants pour GitHub OAuth', { email, githubId });
      return res.status(400).json({ message: 'Champs manquants pour GitHub OAuth' });
    }

    // Recherche de l'utilisateur par githubId OU par email comme fallback
    let user = await User.findOne({ 'oauth.githubId': githubId });
    if (!user) {
      logger.info(`Utilisateur avec githubId ${githubId} non trouvé, recherche par email ${email}`);
      user = await User.findOne({ email });
    }

    const isNewUser = !user;

    // Création de l'utilisateur AVANT la génération des tokens
    if (!user) {
      logger.info(`Création d'un nouvel utilisateur pour GitHub OAuth: ${email}`);
      user = await User.create({
        email,
        firstName,
        lastName,
        role: 'user',
        oauth: {
          provider: 'github',
          githubId
        }
      });
      
      // Vérification que l'utilisateur a bien été créé
      if (!user || !user._id) {
        logger.error('Échec de création d\'utilisateur GitHub OAuth');
        return res.status(500).json({ 
          message: 'Erreur lors de la création de l\'utilisateur' 
        });
      }
      
      logger.info(`Nouvel utilisateur GitHub OAuth créé avec ID: ${user._id}`);
    } else {
      logger.info(`Utilisateur GitHub OAuth existant trouvé: ${user._id}`);
      
      // Mise à jour des informations OAuth si nécessaire
      if (!user.oauth || !user.oauth.githubId) {
        logger.info(`Mise à jour des informations OAuth pour l'utilisateur: ${user._id}`);
        user.oauth = {
          ...user.oauth,
          provider: 'github',
          githubId
        };
        await user.save();
      }
    }

    // Maintenant que nous sommes sûrs que user existe, génération des tokens
    const accessToken = JwtConfig.generateAccessToken(user);
    const refreshToken = JwtConfig.generateRefreshToken(user);

    // Optionnel: stocker le refresh token dans la base de données
    user.refreshToken = refreshToken;
    await user.save();

    logger.info(`Authentification GitHub OAuth réussie pour: ${user._id}`);
    res.status(200).json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isNewUser,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Erreur OAuth GitHub', err);
    res.status(500).json({ message: 'Erreur lors du traitement OAuth GitHub' });
  }
};

// Fonction générique pour les trois méthodes (optionnelle mais recommandée)
exports.handleOAuth = async (req, res, provider) => {
  try {
    const { email, firstName, lastName } = req.body;
    const providerId = req.body[`${provider}Id`];

    if (!email || !providerId) {
      logger.error(`Champs manquants pour ${provider} OAuth`, { email, providerId });
      return res.status(400).json({ message: `Champs manquants pour ${provider} OAuth` });
    }

    // Recherche de l'utilisateur
    let user = await User.findOne({ [`oauth.${provider}Id`]: providerId });
    if (!user) {
      logger.info(`Utilisateur avec ${provider}Id ${providerId} non trouvé, recherche par email ${email}`);
      user = await User.findOne({ email });
    }

    const isNewUser = !user;

    // Création de l'utilisateur si nécessaire
    if (!user) {
      logger.info(`Création d'un nouvel utilisateur pour ${provider} OAuth: ${email}`);
      user = await User.create({
        email,
        firstName,
        lastName,
        role: 'user',
        oauth: {
          provider,
          [`${provider}Id`]: providerId
        }
      });
      
      if (!user || !user._id) {
        logger.error(`Échec de création d'utilisateur ${provider} OAuth`);
        return res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur' });
      }
      
      logger.info(`Nouvel utilisateur ${provider} OAuth créé avec ID: ${user._id}`);
    } else {
      // Mise à jour des informations OAuth si nécessaire
      if (!user.oauth || !user.oauth[`${provider}Id`]) {
        logger.info(`Mise à jour des informations OAuth pour l'utilisateur: ${user._id}`);
        user.oauth = {
          ...user.oauth,
          provider,
          [`${provider}Id`]: providerId
        };
        await user.save();
      }
    }

    // Génération des tokens
    const accessToken = JwtConfig.generateAccessToken(user);
    const refreshToken = JwtConfig.generateRefreshToken(user);

    // Stockage du refresh token
    user.refreshToken = refreshToken;
    await user.save();

    logger.info(`Authentification ${provider} OAuth réussie pour: ${user._id}`);
    res.status(200).json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isNewUser,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error(`Erreur OAuth ${provider}`, err);
    res.status(500).json({ message: `Erreur lors du traitement OAuth ${provider}` });
  }
};