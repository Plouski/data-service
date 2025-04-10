const User = require('../models/User');
const logger = require('../utils/logger');
const JwtConfig = require('../config/jwtConfig');

exports.handleGoogleOAuth = async (req, res) => {
  try {
    const { email, firstName, lastName, googleId } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({ message: 'Champs manquants pour Google OAuth' });
    }

    let user = await User.findOne({ 'oauth.googleId': googleId });

    // Générer les tokens
    const accessToken = JwtConfig.generateAccessToken(user);
    const refreshToken = JwtConfig.generateRefreshToken(user);

    const isNewUser = !user;

    if (!user) {
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
    }

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
      return res.status(400).json({ message: 'Champs manquants pour Facebook OAuth' });
    }

    let user = await User.findOne({ 'oauth.facebookId': facebookId });

    const isNewUser = !user;

    if (!user) {
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
    }

    const accessToken = JwtConfig.generateAccessToken(user);
    const refreshToken = JwtConfig.generateRefreshToken(user);

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
      return res.status(400).json({ message: 'Champs manquants pour GitHub OAuth' });
    }

    let user = await User.findOne({ 'oauth.githubId': githubId });

    const isNewUser = !user;

    if (!user) {
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
    }

    const accessToken = JwtConfig.generateAccessToken(user);
    const refreshToken = JwtConfig.generateRefreshToken(user);

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