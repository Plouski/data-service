const User = require('../models/User');
const Subscription = require('../models/Subscription');
const mongoose = require('mongoose'); // Ajout de cette ligne
const { generateToken } = require('../middlewares/authMiddleware');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class UserController {
  // Créer un nouvel utilisateur
  static async createUser(req, res) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const { email, password, firstName, lastName } = req.body;

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: 'Un utilisateur avec cet email existe déjà' });
      }

      // Créer un nouvel utilisateur
      const newUser = new User({
        email,
        password,
        firstName,
        lastName
      });

      // Créer un abonnement gratuit par défaut
      const defaultSubscription = new Subscription({
        userId: newUser._id,
        plan: 'free',
        startDate: new Date(),
        endDate: (() => {
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 1); // Abonnement gratuit d'un mois
          return endDate;
        })(),
        status: 'active',
        features: {
          maxTrips: 3,
          aiConsultations: 1,
          customization: false
        }
      });

      // Sauvegarder l'utilisateur et l'abonnement
      await newUser.save({ session });
      await defaultSubscription.save({ session });

      // Mettre à jour l'utilisateur avec l'abonnement
      newUser.activeSubscription = defaultSubscription._id;
      await newUser.save({ session });

      // Valider et committer la transaction
      await session.commitTransaction();

      // Générer un token
      const token = generateToken(newUser);

      // Journaliser la création de l'utilisateur
      logger.info(`Nouvel utilisateur créé: ${email} avec abonnement gratuit`);

      // Répondre avec le profil de l'utilisateur et le token
      res.status(201).json({
        user: newUser.toPublicJSON(),
        subscription: {
          plan: defaultSubscription.plan,
          startDate: defaultSubscription.startDate,
          endDate: defaultSubscription.endDate,
          features: defaultSubscription.features
        },
        token
      });
    } catch (error) {
      // Annuler la transaction en cas d'erreur
      await session.abortTransaction();

      logger.error('Erreur lors de la création de l\'utilisateur', error);
      res.status(500).json({ 
        message: 'Erreur lors de la création de l\'utilisateur',
        error: error.message 
      });
    } finally {
      // Terminer la session
      session.endSession();
    }
  }

  // Connexion de l'utilisateur
  static async loginUser(req, res) {
    try {
      const { email, password } = req.body;

      // Rechercher l'utilisateur
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({ message: 'Identifiants invalides' });
      }

      // Vérifier le mot de passe
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Identifiants invalides' });
      }

      // Générer un token
      const token = generateToken(user);

      // Mettre à jour la date de dernière connexion
      user.lastLogin = new Date();
      await user.save();

      // Journaliser la connexion
      logger.info(`Utilisateur connecté: ${email}`);

      // Répondre avec le token et le profil
      res.json({
        token,
        user: user.toPublicJSON()
      });
    } catch (error) {
      logger.error('Erreur lors de la connexion', error);
      res.status(500).json({
        message: 'Erreur lors de la connexion',
        error: error.message
      });
    }
  }

  // Récupérer le profil utilisateur
  static async getUserProfile(req, res) {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      res.json(user.toPublicJSON());
    } catch (error) {
      logger.error('Erreur lors de la récupération du profil', error);
      res.status(500).json({
        message: 'Erreur lors de la récupération du profil',
        error: error.message
      });
    }
  }

  // Mettre à jour le profil utilisateur
  static async updateUserProfile(req, res) {
    try {
      const { firstName, lastName } = req.body;

      const user = await User.findByIdAndUpdate(
        req.user.id,
        { firstName, lastName },
        { new: true, runValidators: true }
      );

      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      // Journaliser la mise à jour
      logger.info(`Profil utilisateur mis à jour: ${user.email}`);

      res.json(user.toPublicJSON());
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du profil', error);
      res.status(500).json({
        message: 'Erreur lors de la mise à jour du profil',
        error: error.message
      });
    }
  }

  // Supprimer le compte utilisateur
  static async deleteUserAccount(req, res) {
    try {
      const user = await User.findByIdAndDelete(req.user.id);

      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      // Journaliser la suppression
      logger.info(`Compte utilisateur supprimé: ${user.email}`);

      res.status(200).json({ message: 'Compte supprimé avec succès' });
    } catch (error) {
      logger.error('Erreur lors de la suppression du compte', error);
      res.status(500).json({
        message: 'Erreur lors de la suppression du compte',
        error: error.message
      });
    }
  }

  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
  
      // Log the request
      console.log(`Forgot password request for email: ${email}`);
  
      // Find the user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }
  
      // Generate reset token using crypto
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now
  
      // Update user with reset token
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = new Date(resetTokenExpiry);
      await user.save();
  
      logger.info(`Token de réinitialisation généré pour ${email}`);
  
      res.status(200).json({ 
        message: 'Token de réinitialisation généré',
        resetToken  // Only for testing, remove in production
      });
  
    } catch (error) {
      console.error('Forgot password error:', error);
      
      logger.error('Erreur lors de la génération du token de réinitialisation', error);
      res.status(500).json({ 
        message: 'Erreur lors de la génération du token de réinitialisation',
        error: error.message 
      });
    }
  }

  static async handleGoogleOAuth(req, res) {
    try {
      const { email, firstName, lastName, googleId } = req.body;

      // Log pour le débogage
      console.log('Requête OAuth Google reçue:', { email, firstName, lastName, googleId });

      // Vérifier si l'utilisateur existe déjà
      let user = await User.findOne({ 
        $or: [
          { email },
          { 'oauth.googleId': googleId }
        ]
      });

      if (!user) {
        // Créer un nouvel utilisateur
        user = new User({
          email,
          firstName,
          lastName,
          oauth: {
            googleId
          },
          isVerified: true  // Les utilisateurs OAuth sont généralement vérifiés
        });

        // Générer un mot de passe temporaire
        const tempPassword = crypto.randomBytes(16).toString('hex');
        user.password = tempPassword;

        await user.save();

        // Créer un abonnement par défaut
        const defaultSubscription = new Subscription({
          userId: user._id,
          plan: 'free',
          startDate: new Date(),
          endDate: (() => {
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);
            return endDate;
          })(),
          status: 'active',
          features: {
            maxTrips: 3,
            aiConsultations: 1,
            customization: false
          }
        });

        await defaultSubscription.save();

        // Mettre à jour l'utilisateur avec l'abonnement
        user.activeSubscription = defaultSubscription._id;
        await user.save();
      }

      // Générer un token
      const token = jwt.sign(
        { 
          userId: user._id, 
          email: user.email,
          role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Log de succès
      logger.info(`Utilisateur OAuth Google connecté: ${email}`);

      res.status(200).json({
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        token
      });

    } catch (error) {
      // Log d'erreur détaillé
      console.error('Erreur lors de la gestion OAuth Google:', error);
      logger.error('Erreur OAuth Google', error);

      res.status(500).json({ 
        message: 'Erreur lors de la connexion OAuth',
        error: error.message 
      });
    }
  }

  static async handleFacebookOAuth(req, res) {
    try {
      let { email, firstName, lastName, facebookId } = req.body;
  
      // Log pour le débogage
      console.log('Requête OAuth Facebook reçue:', { email, firstName, lastName, facebookId });
  
      // Vérifier si l'utilisateur existe déjà
      let user = await User.findOne({ 
        $or: [
          { email },
          { 'oauth.facebookId': facebookId }
        ]
      });
  
      if (!user) {
        if (!email) {
          email = `${facebookId}@facebook-oauth.com`;
        }
  
        // Créer un nouvel utilisateur
        user = new User({
          email,
          firstName,
          lastName,
          oauth: {
            facebookId
          },
          isVerified: true  // Les utilisateurs OAuth sont généralement vérifiés
        });
  
        // Générer un mot de passe temporaire
        const tempPassword = crypto.randomBytes(16).toString('hex');
        user.password = tempPassword;
  
        await user.save();
  
        // Créer un abonnement par défaut
        const defaultSubscription = new Subscription({
          userId: user._id,
          plan: 'free',
          startDate: new Date(),
          endDate: (() => {
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);
            return endDate;
          })(),
          status: 'active',
          features: {
            maxTrips: 3,
            aiConsultations: 1,
            customization: false
          }
        });
  
        await defaultSubscription.save();
  
        // Mettre à jour l'utilisateur avec l'abonnement
        user.activeSubscription = defaultSubscription._id;
        await user.save();
      }
  
      // Générer un token
      const token = jwt.sign(
        { 
          userId: user._id, 
          email: user.email,
          role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
  
      // Log de succès
      logger.info(`Utilisateur OAuth Facebook connecté: ${email}`);
  
      res.status(200).json({
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        token
      });
  
    } catch (error) {
      // Log d'erreur détaillé
      console.error('Erreur lors de la gestion OAuth Facebook:', error);
      logger.error('Erreur OAuth Facebook', error);
  
      res.status(500).json({ 
        message: 'Erreur lors de la connexion OAuth',
        error: error.message 
      });
    }
  }

  static async handleGithubOAuth(req, res) {
    try {
      let { email, firstName, lastName, githubId } = req.body;
  
      // Log pour le débogage
      console.log('Requête OAuth GitHub reçue:', { email, firstName, lastName, githubId });
  
      // Vérifier si l'utilisateur existe déjà
      let user = await User.findOne({ 
        $or: [
          { email },
          { 'oauth.githubId': githubId }
        ]
      });
  
      if (!user) {
        if (!email) {
          email = `${githubId}@github-oauth.com`;
        }
  
        // Créer un nouvel utilisateur
        user = new User({
          email,
          firstName,
          lastName,
          oauth: {
            githubId
          },
          isVerified: true  // Les utilisateurs OAuth sont généralement vérifiés
        });
  
        // Générer un mot de passe temporaire
        const tempPassword = crypto.randomBytes(16).toString('hex');
        user.password = tempPassword;
  
        await user.save();
  
        // Créer un abonnement par défaut
        const defaultSubscription = new Subscription({
          userId: user._id,
          plan: 'free',
          startDate: new Date(),
          endDate: (() => {
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);
            return endDate;
          })(),
          status: 'active',
          features: {
            maxTrips: 3,
            aiConsultations: 1,
            customization: false
          }
        });
  
        await defaultSubscription.save();
  
        // Mettre à jour l'utilisateur avec l'abonnement
        user.activeSubscription = defaultSubscription._id;
        await user.save();
      }
  
      // Générer un token
      const token = jwt.sign(
        { 
          userId: user._id, 
          email: user.email,
          role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
  
      // Log de succès
      logger.info(`Utilisateur OAuth GitHub connecté: ${email}`);
  
      res.status(200).json({
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        token
      });
  
    } catch (error) {
      // Log d'erreur détaillé
      console.error('Erreur lors de la gestion OAuth GitHub:', error);
      logger.error('Erreur OAuth GitHub', error);
  
      res.status(500).json({ 
        message: 'Erreur lors de la connexion OAuth',
        error: error.message 
      });
    }
  }

  static async oauthCallback(req, res) {
    try {
      const user = req.user;
  
      if (!user) {
        return res.status(401).json({ message: 'Utilisateur non authentifié' });
      }
  
      // Génére le token JWT
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
  
      // Option 1 : redirection avec token dans l'URL (à toi de le lire côté front)
      // res.redirect(`http://localhost:3000/oauth-success?token=${token}`);
  
      // Option 2 : renvoyer le token en JSON (utile pour SPA ou mobile app)
      res.status(200).json({
        message: 'Authentification réussie',
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        }
      });
  
    } catch (err) {
      console.error('Erreur callback OAuth :', err);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async getUserById(req, res) {
    try {
      const user = await User.findById(req.params.id).select('-password'); // Masque le mot de passe
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }
      res.status(200).json(user);
    } catch (error) {
      console.error('Erreur dans getUserById :', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  };
}

module.exports = UserController;