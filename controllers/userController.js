const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Trip = require('../models/Trip');
const Favorite = require('../models/Favorite');
const AiHistory = require('../models/AiHistory');
const Payment = require('../models/Payment');
const mongoose = require('mongoose'); // Ajout de cette ligne
const { generateAccessToken } = require('../config/jwtConfig');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class UserController {
  // Créer un nouvel utilisateur
  static async createUser(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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
        lastName,
        isVerified: false
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

      // Générer un token
      const token = generateAccessToken(newUser);

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

      // Valider et committer la transaction
      await session.commitTransaction();
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
      
      if (!user.password) {
        return res.status(400).json({
          message: 'Ce compte utilise l’authentification via Google. Veuillez vous connecter avec Google.'
        });
      }      

      // Vérifier le mot de passe
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Identifiants invalides' });
      }

      // Générer un token
      const token = generateAccessToken(user);

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

  // Récupéré l'utilisateur par email
  static async getUserByEmail(req, res) {
    try {
      const { email } = req.params;
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      res.status(200).json(user.toPublicJSON());
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'utilisateur par email', error);
      res.status(500).json({ message: 'Erreur interne', error: error.message });
    }
  }

  // Récupérer le profil utilisateur
  static async getUserProfile(req, res) {
    try {
      const user = await User.findById(req.user.userId);

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
      const { firstName, lastName, email, phoneNumber } = req.body;

      const update = {};
      if (firstName !== undefined) update.firstName = firstName;
      if (lastName !== undefined) update.lastName = lastName;
      if (email !== undefined) update.email = email;
      if (phoneNumber !== undefined) update.phoneNumber = phoneNumber;

      const user = await User.findByIdAndUpdate(
        req.user.userId,
        update,
        { new: true, runValidators: true }
      );

      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

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

  // Changer le mot de passe
  static async changeUserPassword(req, res) {
    try {
      const userId = req.user.userId;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Champs manquants' });
      }

      // Assure-toi que le champ "password" est inclus
      const user = await User.findById(userId).select('+password');

      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
      }

      user.password = newPassword;
      await user.save();

      logger.info(`Mot de passe changé pour ${user.email}`);
      return res.status(200).json({ message: 'Mot de passe mis à jour avec succès' });

    } catch (error) {
      logger.error('Erreur lors du changement de mot de passe', error);
      return res.status(500).json({
        message: 'Erreur serveur lors du changement de mot de passe',
        error: error.message
      });
    }
  }

  // Supprimer le compte utilisateur
  static async deleteUserAccount(req, res) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const userId = await User.findById(req.user.userId);

      // Supprimer l'utilisateur
      const user = await User.findByIdAndDelete(userId, { session });

      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      // Supprimer les abonnements associés
      await Subscription.deleteMany({ userId }, { session });

      // Supprimer les roadtrips
      await Trip.deleteMany({ userId }, { session });

      // Supprimer les historiques d'interactions IA
      await AiHistory.deleteMany({ userId }, { session });

      // Supprimer les favoris
      await Favorite.deleteMany({ userId }, { session });

      // Supprimer les paiements
      await Payment.deleteMany({ userId }, { session });

      // Autres suppressions potentielles:
      // - Commentaires
      // - Notifications
      // - Collaborations
      // - etc.

      await session.commitTransaction();

      // Journaliser la suppression
      logger.info(`Compte utilisateur et toutes ses données associées supprimés: ${user.email}`);

      res.status(200).json({ message: 'Compte et toutes les données associées supprimés avec succès' });
    } catch (error) {
      await session.abortTransaction();
      logger.error('Erreur lors de la suppression du compte et des données', error);

      res.status(500).json({
        message: 'Erreur lors de la suppression du compte',
        error: error.message
      });
    } finally {
      session.endSession();
    }
  }

  // Réinitialisation du mot de passe
  static async resetPassword(req, res) {
    const { email, resetCode, newPassword } = req.body;

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({
        message: 'Champs requis manquants'
      });
    }

    const user = await User.findOne({ email, resetCode });

    if (!user || user.resetCodeExpires < Date.now()) {
      return res.status(400).json({
        message: 'Code de réinitialisation invalide ou expiré'
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetCode = undefined;
    user.resetCodeExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  }

  // Stocker le code de reset
  static async storeResetToken(req, res) {
    const { email, resetToken, resetCode, expiresAt } = req.body;

    if (!email || !resetToken || !resetCode || !expiresAt) {
      return res.status(400).json({ message: 'Données manquantes' });
    }

    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

      user.passwordResetToken = {
        token: resetToken,
        code: resetCode,
        expiresAt: new Date(expiresAt),
      };

      await user.save();
      return res.status(200).json({ message: 'Token enregistré' });
    } catch (error) {
      console.error('Erreur enregistrement token reset :', error);
      return res.status(500).json({ message: 'Erreur serveur' });
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
      const { id } = req.params;
      console.log(`Recherche de l'utilisateur avec l'ID: ${id}`);
  
      // Cas spécial pour "profile" ou "me" - utiliser l'ID de l'utilisateur authentifié
      if (id === 'me' || id === 'profile') {
        console.log('Récupération du profil de l\'utilisateur authentifié');
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
          return res.status(404).json({ message: 'Utilisateur authentifié non trouvé' });
        }
        
        return res.status(200).json(user);
      }
  
      // Validation normale pour les autres cas
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'ID utilisateur invalide' });
      }
  
      const user = await User.findById(id).select('-password');
      console.log('Utilisateur trouvé:', user);
  
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }
  
      res.status(200).json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async getUserByEmail(req, res) {
    try {
      const { email } = req.params;
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      // Retourner les informations publiques de l'utilisateur
      res.json({
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'utilisateur', error);
      res.status(500).json({
        message: 'Erreur lors de la récupération de l\'utilisateur',
        error: error.message
      });
    }
  }

  static async updateVerificationStatus(req, res) {
    try {
      const { userId } = req.params;
      const { isVerified } = req.body;

      const user = await User.findByIdAndUpdate(
        userId,
        { isVerified },
        { new: true, runValidators: true }
      );

      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      logger.info(`Statut de vérification mis à jour pour ${userId}`);
      res.json(user);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du statut de vérification', error);
      res.status(500).json({
        message: 'Erreur lors de la mise à jour du statut',
        error: error.message
      });
    }
  }

  static async createPasswordResetToken(req, res) {
    try {
      const { userId } = req.params;
      const { resetToken, resetCode, expiresAt } = req.body;
  
      console.log('Création du token de réinitialisation :', {
        userId,
        resetCode,
        expiresAt: new Date(expiresAt)
      });
  
      const user = await User.findByIdAndUpdate(
        userId, 
        {
          resetPasswordToken: resetToken,
          resetPasswordCode: resetCode,
          resetPasswordExpires: expiresAt
        },
        { 
          new: true, 
          runValidators: true,
          context: 'query' // Important pour déclencher les validations
        }
      );
  
      if (!user) {
        console.error(`Utilisateur non trouvé pour l'ID: ${userId}`);
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }
  
      console.log('Utilisateur mis à jour :', {
        _id: user._id,
        email: user.email,
        resetPasswordCode: user.resetPasswordCode,
        resetPasswordExpires: user.resetPasswordExpires
      });
  
      logger.info(`Token de réinitialisation créé pour l'utilisateur ${userId}`);
      res.json({ message: 'Token de réinitialisation créé avec succès' });
    } catch (error) {
      console.error('Erreur détaillée :', error);
      logger.error('Erreur lors de la création du token de réinitialisation', error);
      res.status(500).json({ 
        message: 'Erreur lors de la création du token',
        error: error.message 
      });
    }
  }

  static async storeVerificationToken(req, res) {
    try {
      const { userId } = req.params;
      const { token, code, expiresAt } = req.body;

      const user = await User.findByIdAndUpdate(
        userId,
        {
          verificationToken: token,
          verificationCode: code,
          verificationExpires: expiresAt
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      logger.info(`Token de vérification stocké pour ${userId}`);
      res.json({
        success: true,
        message: 'Token de vérification stocké avec succès'
      });
    } catch (error) {
      logger.error('Erreur lors du stockage du token de vérification', error);
      res.status(500).json({
        message: 'Erreur lors du stockage du token',
        error: error.message
      });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { email, resetCode, newPassword } = req.body;
  
      // Recherche de l'utilisateur avec email ET code
      const user = await User.findOne({
        email: email.toLowerCase(),
        resetPasswordCode: resetCode
      });
  
      // Si aucun utilisateur n'est trouvé, vérifier s'il existe des correspondances
      if (!user) {
        const matchingUsers = await User.find({
          $or: [
            { email: email.toLowerCase() },
            { resetPasswordCode: resetCode }
          ]
        });
  
        return res.status(400).json({ 
          message: 'Code de réinitialisation invalide ou ne correspond pas à cet email',
          details: {
            emailFound: matchingUsers.some(u => u.email === email.toLowerCase()),
            codeFound: matchingUsers.some(u => u.resetPasswordCode === resetCode),
            matchingEmails: matchingUsers.map(u => u.email)
          }
        });
      }
  
      // Mettre à jour le mot de passe
      user.password = newPassword;
      user.resetPasswordCode = null;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
  
      await user.save();
  
      logger.info(`Mot de passe réinitialisé pour ${email}`);
  
      res.json({ message: 'Mot de passe réinitialisé avec succès' });
    } catch (error) {
      logger.error('Erreur lors de la réinitialisation du mot de passe', error);
      res.status(500).json({ 
        message: 'Erreur lors de la réinitialisation du mot de passe',
        error: error.message 
      });
    }
  }

  static async verifyAccount(req, res) {
    try {
      const { email, verificationToken } = req.body;
  
      // Rechercher l'utilisateur avec le token de vérification
      const user = await User.findOne({
        email: email.toLowerCase(),
        verificationToken: verificationToken
      });
  
      if (!user) {
        return res.status(400).json({ 
          message: 'Token de vérification invalide ou expiré' 
        });
      }
  
      // Vérifier si le token est encore valide
      if (user.verificationTokenExpires < new Date()) {
        return res.status(400).json({ 
          message: 'Token de vérification expiré' 
        });
      }
  
      // Mettre à jour le statut de vérification
      user.isVerified = true;
      user.verificationToken = null;
      user.verificationTokenExpires = null;
  
      await user.save();
  
      logger.info(`Compte vérifié pour ${email}`);
  
      res.json({ 
        message: 'Compte vérifié avec succès',
        user: user.toPublicJSON()
      });
    } catch (error) {
      logger.error('Erreur lors de la vérification du compte', error);
      res.status(500).json({ 
        message: 'Erreur lors de la vérification du compte',
        error: error.message 
      });
    }
  }

  static async createVerificationToken(req, res) {
    try {
      const { userId } = req.params;
      const { verificationToken, expiresAt } = req.body;
  
      const user = await User.findByIdAndUpdate(
        userId, 
        {
          verificationToken,
          verificationTokenExpires: expiresAt,
          isVerified: false
        },
        { new: true, runValidators: true }
      );
  
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }
  
      logger.info(`Token de vérification créé pour l'utilisateur ${userId}`);
      res.json({ message: 'Token de vérification créé avec succès' });
    } catch (error) {
      logger.error('Erreur lors de la création du token de vérification', error);
      res.status(500).json({ 
        message: 'Erreur lors de la création du token',
        error: error.message 
      });
    }
  }
}
}

module.exports = UserController;