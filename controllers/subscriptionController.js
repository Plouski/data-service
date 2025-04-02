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
}

module.exports = SubscriptionController;