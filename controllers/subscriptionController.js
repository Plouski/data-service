const SubscriptionService = require('../services/subscriptionService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const sanitizeHtml = require('sanitize-html');

class SubscriptionController {
  // Récupérer l'abonnement actuel de l'utilisateur
  static async getCurrentSubscription(req, res) {
    try {
      const userId = req.user.id;

      // Récupérer l'abonnement actif
      const subscription = await SubscriptionService.getCurrentSubscription(userId);

      if (!subscription) {
        return res.status(404).json({
          message: 'Aucun abonnement actif trouvé'
        });
      }

      res.json(subscription);
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'abonnement', error);
      res.status(500).json({
        message: 'Erreur lors de la récupération de l\'abonnement',
        error: error.message
      });
    }
  }

  // Mettre à jour l'abonnement
  static async updateSubscription(req, res) {
    try {
      // Validation des erreurs de requête
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array(),
          message: 'Erreurs de validation des données'
        });
      }

      const userId = req.user.id;
      const { plan, paymentMethod } = req.body;

      // Nettoyer les données
      const sanitizedPaymentMethod = paymentMethod ? sanitizeHtml(paymentMethod, {
        allowedTags: [],
        allowedAttributes: {}
      }) : undefined;

      // Mettre à jour l'abonnement
      const updatedSubscription = await SubscriptionService.updateSubscription(
        userId,
        {
          plan,
          paymentMethod: sanitizedPaymentMethod
        }
      );

      logger.info(`Abonnement mis à jour pour l'utilisateur ${userId}: ${plan}`);
      res.json(updatedSubscription);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de l\'abonnement', error);

      // Gestion des erreurs spécifiques
      if (error.message.includes('Plan invalide')) {
        return res.status(400).json({
          message: 'Plan d\'abonnement invalide'
        });
      }

      res.status(500).json({
        message: 'Erreur lors de la mise à jour de l\'abonnement',
        error: error.message
      });
    }
  }

  static async updateFromPaymentService(req, res) {
    try {
      // Vérifier que la requête vient bien d'un autre service via l'API key
      if (!req.isServiceRequest) {
        return res.status(403).json({
          message: 'Accès non autorisé'
        });
      }

      const { userId, plan, paymentMethod, sessionId, status } = req.body;

      logger.info(`Mise à jour d'abonnement depuis le service de paiement pour l'utilisateur ${userId}`);

      // Utilisez le service d'abonnement pour effectuer la mise à jour
      // Si l'utilisateur a déjà un abonnement, le mettre à jour, sinon en créer un nouveau
      const subscription = await SubscriptionService.getOrCreateSubscription({
        userId,
        plan,
        paymentMethod,
        externalReferenceId: sessionId,
        status
      });

      res.status(200).json({
        success: true,
        subscription
      });
    } catch (error) {
      logger.error("Erreur lors de la mise à jour d'abonnement depuis le service de paiement", error);
      res.status(500).json({
        message: "Erreur lors de la mise à jour d'abonnement",
        error: error.message
      });
    }
  }

  // Annuler l'abonnement
  static async cancelSubscription(req, res) {
    try {
      const userId = req.user.id;

      // Annuler l'abonnement
      await SubscriptionService.cancelSubscription(userId);

      logger.info(`Abonnement annulé pour l'utilisateur ${userId}`);
      res.status(200).json({
        message: 'Abonnement annulé avec succès'
      });
    } catch (error) {
      logger.error('Erreur lors de l\'annulation de l\'abonnement', error);
      res.status(500).json({
        message: 'Erreur lors de l\'annulation de l\'abonnement',
        error: error.message
      });
    }
  }

  // Réactiver un abonnement précédemment annulé
  static async reactivateSubscription(req, res) {
    try {
      // Validation des erreurs de requête
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array(),
          message: 'Erreurs de validation des données'
        });
      }

      const userId = req.user.id;
      const { plan, paymentMethod } = req.body;

      // Nettoyer les données
      const sanitizedPaymentMethod = paymentMethod ? sanitizeHtml(paymentMethod, {
        allowedTags: [],
        allowedAttributes: {}
      }) : undefined;

      // Réactiver l'abonnement
      const reactivatedSubscription = await SubscriptionService.reactivateSubscription(
        userId,
        {
          plan,
          paymentMethod: sanitizedPaymentMethod
        }
      );

      logger.info(`Abonnement réactivé pour l'utilisateur ${userId}: ${plan}`);
      res.json(reactivatedSubscription);
    } catch (error) {
      logger.error('Erreur lors de la réactivation de l\'abonnement', error);

      // Gestion des erreurs spécifiques
      if (error.message.includes('Plan invalide')) {
        return res.status(400).json({
          message: 'Plan d\'abonnement invalide'
        });
      }

      res.status(500).json({
        message: 'Erreur lors de la réactivation de l\'abonnement',
        error: error.message
      });
    }
  }

  // Récupérer l'historique des abonnements
  static async getSubscriptionHistory(req, res) {
    try {
      const userId = req.user.id;
      const {
        limit,
        page,
        status
      } = req.query;

      const subscriptionHistory = await SubscriptionService.getSubscriptionHistory(
        userId,
        {
          limit: parseInt(limit) || 50,
          page: parseInt(page) || 1,
          status
        }
      );

      res.json(subscriptionHistory);
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'historique des abonnements', error);
      res.status(500).json({
        message: 'Erreur lors de la récupération de l\'historique des abonnements',
        error: error.message
      });
    }
  }

  // Vérifier les fonctionnalités disponibles
  static async checkAvailableFeatures(req, res) {
    try {
      const userId = req.user.id;

      const features = await SubscriptionService.checkAvailableFeatures(userId);

      res.json(features);
    } catch (error) {
      logger.error('Erreur lors de la vérification des fonctionnalités', error);
      res.status(500).json({
        message: 'Erreur lors de la vérification des fonctionnalités',
        error: error.message
      });
    }
  }

  static async recordPayment(req, res) {
    try {
      // Vérifier que la requête vient bien d'un autre service via l'API key
      if (!req.isServiceRequest) {
        return res.status(403).json({
          message: 'Accès non autorisé'
        });
      }

      const { userId, amount, currency = 'EUR', transactionId, invoiceId, status = 'success' } = req.body;

      logger.info(`Enregistrement de paiement pour l'utilisateur ${userId}`);

      // Trouver l'abonnement actif de l'utilisateur
      const subscription = await Subscription.findOne({
        userId,
        status: 'active'
      });

      if (!subscription) {
        return res.status(404).json({
          message: 'Aucun abonnement actif trouvé'
        });
      }

      // Ajouter le paiement à l'historique
      await subscription.addPaymentToHistory({
        date: new Date(),
        amount,
        currency,
        status,
        transactionId,
        invoiceId
      });

      res.status(200).json({
        success: true,
        message: 'Paiement enregistré avec succès'
      });
    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement du paiement', error);
      res.status(500).json({
        message: 'Erreur lors de l\'enregistrement du paiement',
        error: error.message
      });
    }
  }

  // Obtenir le statut d'abonnement d'un utilisateur pour les services externes
  static async getSubscriptionStatus(req, res) {
    try {
      const { userId } = req.params;

      // Vérifier que la requête a l'autorisation de service ou qu'elle provient du propriétaire
      if (!req.isServiceRequest && req.user?.id !== userId) {
        return res.status(403).json({
          message: 'Accès non autorisé'
        });
      }

      // Trouver l'abonnement actif
      const subscription = await Subscription.findOne({
        userId,
        status: 'active',
        endDate: { $gt: new Date() }
      });

      if (!subscription) {
        return res.status(200).json({
          success: true,
          subscription: null,
          isPremium: false
        });
      }

      // Déterminer si l'utilisateur a un abonnement premium
      const isPremium = subscription.plan === 'premium' || subscription.plan === 'enterprise';

      res.status(200).json({
        success: true,
        subscription: {
          id: subscription._id,
          plan: subscription.plan,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          features: subscription.features
        },
        isPremium
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération du statut d\'abonnement', error);
      res.status(500).json({
        message: 'Erreur lors de la récupération du statut d\'abonnement',
        error: error.message
      });
    }
  }
}

module.exports = SubscriptionController;