const Subscription = require('../models/Subscription');
const User = require('../models/User');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');

class SubscriptionService {
  // Récupérer l'abonnement actuel de l'utilisateur
  static async getCurrentSubscription(userId) {
    try {
      const subscription = await Subscription.findOne({
        userId,
        status: 'active',
        endDate: { $gt: new Date() }
      }).populate('userId', 'email firstName lastName');

      return subscription;
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'abonnement actuel', error);
      throw error;
    }
  }

  // Mettre à jour l'abonnement
  static async updateSubscription(userId, updateData) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Valider le plan
      if (!['free', 'standard', 'premium', 'enterprise'].includes(updateData.plan)) {
        throw new Error('Plan invalide');
      }

      // Rechercher l'abonnement actuel
      const currentSubscription = await Subscription.findOne({
        userId,
        status: 'active',
        endDate: { $gt: new Date() }
      }).session(session);

      if (!currentSubscription) {
        throw new Error('Aucun abonnement actif trouvé');
      }

      // Mettre à jour l'abonnement
      const updatedSubscription = await Subscription.findByIdAndUpdate(
        currentSubscription._id,
        {
          plan: updateData.plan,
          'paymentInfo.method': updateData.paymentMethod 
            ? sanitizeHtml(updateData.paymentMethod) 
            : currentSubscription.paymentInfo.method,
          // Ajuster la date de fin selon le nouveau plan
          endDate: this.calculateEndDate(updateData.plan)
        },
        { 
          new: true, 
          runValidators: true,
          session 
        }
      );

      // Mettre à jour l'utilisateur avec le nouveau plan
      await User.findByIdAndUpdate(
        userId, 
        { role: this.mapPlanToRole(updateData.plan) },
        { session }
      );

      await session.commitTransaction();

      logger.info(`Abonnement mis à jour pour l'utilisateur ${userId}: ${updateData.plan}`);
      return updatedSubscription;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Erreur lors de la mise à jour de l\'abonnement', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Annuler l'abonnement
  static async cancelSubscription(userId) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Rechercher l'abonnement actif
      const currentSubscription = await Subscription.findOne({
        userId,
        status: 'active',
        endDate: { $gt: new Date() }
      }).session(session);

      if (!currentSubscription) {
        throw new Error('Aucun abonnement actif trouvé');
      }

      // Mettre à jour le statut de l'abonnement
      const canceledSubscription = await Subscription.findByIdAndUpdate(
        currentSubscription._id,
        {
          status: 'canceled',
          endDate: new Date() // Fin immédiate
        },
        { 
          new: true,
          session 
        }
      );

      // Réinitialiser les informations utilisateur
      await User.findByIdAndUpdate(
        userId, 
        { 
          role: 'user', 
          activeSubscription: null 
        },
        { session }
      );

      await session.commitTransaction();

      logger.info(`Abonnement annulé pour l'utilisateur ${userId}`);
      return canceledSubscription;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Erreur lors de l\'annulation de l\'abonnement', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Réactiver un abonnement
  static async reactivateSubscription(userId, reactivationData) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Valider le plan
      if (!['free', 'standard', 'premium', 'enterprise'].includes(reactivationData.plan)) {
        throw new Error('Plan invalide');
      }

      // Créer un nouvel abonnement
      const newSubscription = new Subscription({
        userId,
        plan: reactivationData.plan,
        startDate: new Date(),
        endDate: this.calculateEndDate(reactivationData.plan),
        status: 'active',
        paymentInfo: {
          method: reactivationData.paymentMethod 
            ? sanitizeHtml(reactivationData.paymentMethod) 
            : ''
        }
      });

      await newSubscription.save({ session });

      // Mettre à jour l'utilisateur
      await User.findByIdAndUpdate(
        userId, 
        { 
          role: this.mapPlanToRole(reactivationData.plan),
          activeSubscription: newSubscription._id 
        },
        { session }
      );

      await session.commitTransaction();

      logger.info(`Abonnement réactivé pour l'utilisateur ${userId}: ${reactivationData.plan}`);
      return newSubscription;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Erreur lors de la réactivation de l\'abonnement', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Récupérer l'historique des abonnements
  static async getSubscriptionHistory(userId, options = {}) {
    const { 
      limit = 50, 
      page = 1, 
      status 
    } = options;

    try {
      const query = { userId };
      if (status) query.status = status;

      const subscriptions = await Subscription.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await Subscription.countDocuments(query);

      return {
        subscriptions,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'historique des abonnements', error);
      throw error;
    }
  }

  // Vérifier les fonctionnalités disponibles
  static async checkAvailableFeatures(userId) {
    try {
      const subscription = await this.getCurrentSubscription(userId);

      if (!subscription) {
        // Plan par défaut si aucun abonnement actif
        return {
          plan: 'free',
          maxTrips: 3,
          aiConsultations: 1,
          customization: false
        };
      }

      return {
        plan: subscription.plan,
        maxTrips: subscription.features.maxTrips,
        aiConsultations: subscription.features.aiConsultations,
        customization: subscription.features.customization
      };
    } catch (error) {
      logger.error('Erreur lors de la vérification des fonctionnalités', error);
      throw error;
    }
  }

  // Méthodes utilitaires privées
  static calculateEndDate(plan) {
    const endDate = new Date();
    switch(plan) {
      case 'free':
        endDate.setMonth(endDate.getMonth() + 1); // 1 mois
        break;
      case 'standard':
      case 'premium':
        endDate.setMonth(endDate.getMonth() + 12); // 1 an
        break;
      case 'enterprise':
        endDate.setFullYear(endDate.getFullYear() + 1); // 1 an
        break;
      default:
        throw new Error('Plan invalide');
    }
    return endDate;
  }

  static mapPlanToRole(plan) {
    switch(plan) {
      case 'standard': return 'user';
      case 'premium': return 'premium';
      case 'enterprise': return 'admin';
      default: return 'user';
    }
  }
}

module.exports = SubscriptionService;