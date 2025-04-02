const AiService = require('../services/aiService');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const sanitizeHtml = require('sanitize-html');

class AiController {
  // Enregistrer une interaction IA
  static async saveAiInteraction(req, res) {
    try {
      // Validation des erreurs de requête
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          errors: errors.array(),
          message: 'Erreurs de validation des données' 
        });
      }

      // Nettoyer et valider les entrées
      const sanitizedInteractionData = {
        input: sanitizeHtml(req.body.input, { 
          allowedTags: [], 
          allowedAttributes: {} 
        }),
        response: sanitizeHtml(req.body.response, { 
          allowedTags: [], 
          allowedAttributes: {} 
        }),
        category: req.body.category || 'other',
        context: {
          tripId: req.body.tripId || null,
          additionalContext: req.body.additionalContext || null
        }
      };

      // Enregistrer l'interaction via le service
      const savedInteraction = await AiService.saveAiInteraction(
        req.user.id, 
        sanitizedInteractionData
      );

      // Journaliser l'interaction
      logger.info(`Interaction IA enregistrée pour l'utilisateur ${req.user.id}`);

      // Répondre avec l'interaction sauvegardée
      res.status(201).json(savedInteraction);
    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement de l\'interaction IA', error);
      
      // Gestion des erreurs spécifiques
      if (error.message.includes('Limite de consultations IA atteinte')) {
        return res.status(403).json({ 
          message: 'Limite de consultations IA atteinte pour votre abonnement' 
        });
      }

      res.status(500).json({ 
        message: 'Erreur interne lors de l\'enregistrement de l\'interaction IA',
        error: error.message 
      });
    }
  }

  // Récupérer l'historique des interactions IA
  static async getAiHistory(req, res) {
    try {
      const { 
        limit, 
        page, 
        category, 
        startDate, 
        endDate 
      } = req.query;

      const aiHistory = await AiService.getAiHistory(req.user.id, {
        limit: parseInt(limit) || 50,
        page: parseInt(page) || 1,
        category: category || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      });

      res.json(aiHistory);
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'historique IA', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération de l\'historique IA',
        error: error.message 
      });
    }
  }

  // Ajouter un feedback à une interaction IA
  static async addAiFeedback(req, res) {
    try {
      // Validation des erreurs de requête
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          errors: errors.array(),
          message: 'Erreurs de validation des données' 
        });
      }

      const interactionId = req.params.id;
      const feedbackData = {
        rating: req.body.rating,
        comment: sanitizeHtml(req.body.comment || '', { 
          allowedTags: [], 
          allowedAttributes: {} 
        })
      };

      const updatedInteraction = await AiService.addAiFeedback(
        req.user.id, 
        interactionId, 
        feedbackData
      );

      logger.info(`Feedback ajouté à l'interaction IA ${interactionId}`);
      res.json(updatedInteraction);
    } catch (error) {
      logger.error('Erreur lors de l\'ajout du feedback IA', error);
      res.status(500).json({ 
        message: 'Erreur lors de l\'ajout du feedback',
        error: error.message 
      });
    }
  }

  // Supprimer un historique d'interaction IA
  static async deleteAiInteraction(req, res) {
    try {
      const interactionId = req.params.id;

      await AiService.deleteAiInteraction(req.user.id, interactionId);

      logger.info(`Interaction IA supprimée: ${interactionId}`);
      res.status(200).json({ 
        message: 'Interaction IA supprimée avec succès' 
      });
    } catch (error) {
      logger.error('Erreur lors de la suppression de l\'interaction IA', error);
      res.status(500).json({ 
        message: 'Erreur lors de la suppression de l\'interaction IA',
        error: error.message 
      });
    }
  }
}

module.exports = AiController;