const User = require('../models/User');
const Subscription = require('../models/Subscription');
const mongoose = require('mongoose'); // Ajout de cette ligne
const { generateToken } = require('../middlewares/authMiddleware');
const logger = require('../utils/logger');

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
}

module.exports = UserController;