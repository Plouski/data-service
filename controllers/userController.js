const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Trip = require('../models/Trip');
const Favorite = require('../models/Favorite');
const AiHistory = require('../models/AiHistory');
const Payment = require('../models/Payment');
const mongoose = require('mongoose'); // Ajout de cette ligne
const { generateAccessToken } = require('../config/jwtConfig');
const logger = require('../utils/logger');

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
}

module.exports = UserController;