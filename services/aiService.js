const AiHistory = require('../models/AiHistory');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

class AiService {
  // Enregistrer une interaction IA
  static async saveAiInteraction(userId, interactionData) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Vérifier les limites de l'abonnement
      const subscription = await Subscription.findActiveSubscription(userId);
      if (!subscription) {
        throw new Error('Aucun abonnement actif');
      }

      // Compter les interactions récentes
      const recentInteractionsCount = await AiHistory.countDocuments({ 
        userId,
        createdAt: { 
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Dernières 24h
        }
      });

      // Vérifier les limites d'utilisation de l'IA
      if (recentInteractionsCount >= subscription.features.aiConsultations) {
        throw new Error('Limite de consultations IA atteinte pour votre abonnement');
      }

      // Créer un nouvel historique d'interaction IA
      const newAiInteraction = new AiHistory({
        userId,
        input: interactionData.input,
        response: interactionData.response,
        category: interactionData.category || 'other',
        context: {
          tripId: interactionData.tripId || null,
          additionalContext: interactionData.additionalContext || null
        }
      });

      await newAiInteraction.save({ session });

      await session.commitTransaction();
      
      logger.info(`Interaction IA enregistrée pour l'utilisateur ${userId}`);
      return newAiInteraction;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Erreur lors de l\'enregistrement de l\'interaction IA', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Récupérer l'historique des interactions IA
  static async getAiHistory(userId, options = {}) {
    const { 
      limit = 50, 
      page = 1,
      category = null,
      startDate = null,
      endDate = null,
      sort = { createdAt: -1 }
    } = options;

    try {
      const query = { userId };

      // Filtres optionnels
      if (category) {
        query.category = category;
      }

      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const aiHistory = await AiHistory.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: 'context.tripId',
          select: 'title description'
        });

      const total = await AiHistory.countDocuments(query);

      return {
        aiHistory,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'historique IA', error);
      throw error;
    }
  }

  // Ajouter un feedback à une interaction IA
  static async addAiFeedback(userId, interactionId, feedbackData) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Vérifier que l'interaction appartient à l'utilisateur
      const aiInteraction = await AiHistory.findOne({ 
        _id: interactionId, 
        userId 
      });

      if (!aiInteraction) {
        throw new Error('Interaction IA non trouvée ou non autorisée');
      }

      // Mettre à jour avec le feedback
      const updatedInteraction = await AiHistory.findByIdAndUpdate(
        interactionId,
        { 
          $set: { 
            feedback: {
              rating: feedbackData.rating,
              comment: feedbackData.comment || ''
            }
          } 
        },
        { 
          new: true,
          runValidators: true,
          session 
        }
      );

      await session.commitTransaction();

      logger.info(`Feedback ajouté à l'interaction IA ${interactionId}`);
      return updatedInteraction;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Erreur lors de l\'ajout du feedback IA', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Analyser les statistiques d'utilisation de l'IA
  static async getAiUsageStats(userId, options = {}) {
    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 derniers jours
      endDate = new Date() 
    } = options;

    try {
      const stats = await AiHistory.aggregate([
        // Filtrer par utilisateur et période
        { 
          $match: { 
            userId: mongoose.Types.ObjectId(userId),
            createdAt: { 
              $gte: new Date(startDate), 
              $lte: new Date(endDate) 
            }
          } 
        },
        // Grouper par catégorie
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalInputTokens: { $sum: '$tokens.input' },
            totalOutputTokens: { $sum: '$tokens.output' },
            averageRating: { $avg: '$feedback.rating' }
          }
        },
        // Trier par nombre d'interactions
        { $sort: { count: -1 } }
      ]);

      // Calculs supplémentaires
      const totalInteractions = stats.reduce((sum, stat) => sum + stat.count, 0);
      const totalTokens = stats.reduce((sum, stat) => sum + stat.totalInputTokens + stat.totalOutputTokens, 0);

      return {
        periodStart: startDate,
        periodEnd: endDate,
        totalInteractions,
        totalTokens,
        categoryBreakdown: stats
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des statistiques IA', error);
      throw error;
    }
  }
}

module.exports = AiService;