const User = require('../models/User');
const Subscription = require('../models/Subscription');
const AiHistory = require('../models/AiHistory');
const Favorite = require('../models/Favorite');
const Payment = require('../models/Payment');
const Trip = require('../models/Trip');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

class UserService {

  // Rechercher des trips publics
  static async searchUsers(searchOptions) {
    const { query = '', limit = 20, page = 1 } = searchOptions;

    try {
      const searchQuery = {
        isPublic: true,
        $or: [
          { email: { $regex: query, $options: 'i' } },
          { firstName: { $regex: query, $options: 'i' } },
          { lastName: { $regex: query, $options: 'i' } }
        ]
      };

      const users = await User.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-__v');

      const total = await User.countDocuments(searchQuery);

      return {
        users,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error("Erreur lors de la recherche d'utilisateur", error);
      throw error;
    }
  }

  // Créer un nouvel utilisateur
  static async createUser(userData) {
    // Commencer une transaction pour garantir la cohérence des données
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      // Créer l'utilisateur
      const newUser = new User(userData);
      await newUser.save({ session });

      // Créer un abonnement par défaut
      const defaultSubscription = new Subscription({
        userId: newUser._id,
        plan: 'free',
        startDate: new Date(),
        endDate: null // Abonnement gratuit sans date de fin
      });
      await defaultSubscription.save({ session });

      // Mettre à jour l'utilisateur avec l'abonnement
      newUser.activeSubscription = defaultSubscription._id;
      await newUser.save({ session });

      // Valider et committer la transaction
      await session.commitTransaction();
      
      logger.info(`Utilisateur créé avec succès: ${newUser.email}`);
      return newUser;
    } catch (error) {
      // Annuler la transaction en cas d'erreur
      await session.abortTransaction();
      
      logger.error('Erreur lors de la création de l\'utilisateur', error);
      throw error;
    } finally {
      // Terminer la session
      session.endSession();
    }
  }

  // Récupérer le profil complet d'un utilisateur
  static async getUserProfileById(userId) {
    try {
      // Récupérer l'utilisateur avec son abonnement
      const userProfile = await User.findById(userId)
        .populate({
          path: 'activeSubscription',
          model: 'Subscription',
          select: 'plan startDate endDate status'
        })
        .lean(); // Convertir en objet JavaScript simple

      if (!userProfile) {
        throw new Error('Utilisateur non trouvé');
      }

      // Supprimer le mot de passe avant de retourner
      delete userProfile.password;

      return userProfile;
    } catch (error) {
      logger.error('Erreur lors de la récupération du profil', error);
      throw error;
    }
  }

  // Mettre à jour le profil utilisateur
  static async updateUserProfile(userId, updateData) {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId, 
        { $set: updateData },
        { 
          new: true,  // Retourner le document mis à jour
          runValidators: true  // Valider les données avant mise à jour
        }
      );

      if (!updatedUser) {
        throw new Error('Utilisateur non trouvé');
      }

      logger.info(`Profil mis à jour pour l'utilisateur: ${userId}`);
      return updatedUser;
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du profil', error);
      throw error;
    }
  }

  // Supprimer un compte utilisateur
  static async deleteUserAccount(userId) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Supprimer l'utilisateur et ses données associées
      await User.findByIdAndDelete(userId, { session });
      await Subscription.deleteMany({ userId }, { session });
      await AiHistory.deleteMany({ userId }, { session });
      await Favorite.deleteMany({ userId }, { session });
      await Payment.deleteMany({ userId }, { session });
      await Trip.deleteMany({ userId }, { session });
      // Ajouter la suppression d'autres collections liées (favoris, trips, etc.)

      await session.commitTransaction();
      
      logger.info(`Compte utilisateur supprimé: ${userId}`);
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Erreur lors de la suppression du compte', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Méthodes utilitaires supplémentaires
  static async findUserByEmail(email) {
    try {
      return await User.findOne({ email }).select('+password');
    } catch (error) {
      logger.error('Erreur lors de la recherche par email', error);
      throw error;
    }
  }
}

module.exports = UserService;