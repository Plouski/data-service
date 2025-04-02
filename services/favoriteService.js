const Favorite = require('../models/Favorite');
const Trip = require('../models/Trip');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

class FavoriteService {
  // Ajouter un trip aux favoris
  static async addToFavorites(userId, tripId, additionalData = {}) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Vérifier si le trip existe
      const trip = await Trip.findById(tripId);
      if (!trip) {
        throw new Error('Trip non trouvé');
      }

      // Vérifier si déjà en favoris
      const existingFavorite = await Favorite.findOne({ 
        userId, 
        tripId 
      });

      if (existingFavorite) {
        throw new Error('Ce trip est déjà dans vos favoris');
      }

      // Créer un nouveau favori
      const newFavorite = new Favorite({
        userId,
        tripId,
        notes: additionalData.notes || '',
        customTags: additionalData.customTags || [],
        plannedDate: additionalData.plannedDate || null,
        priority: additionalData.priority || 'basse'
      });

      await newFavorite.save({ session });

      // Peupler avec les détails du trip
      await newFavorite.populate({
        path: 'tripId',
        select: 'title description season budget difficulty'
      });

      await session.commitTransaction();

      logger.info(`Trip ajouté aux favoris: ${tripId} pour l'utilisateur ${userId}`);
      return newFavorite;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Erreur lors de l\'ajout aux favoris', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Récupérer les favoris d'un utilisateur
  static async getUserFavorites(userId, options = {}) {
    const { 
      limit = 50, 
      page = 1,
      sort = { createdAt: -1 },
      filters = {} 
    } = options;

    try {
      const query = { 
        userId,
        ...filters
      };

      const favorites = await Favorite.find(query)
        .populate({
          path: 'tripId',
          select: 'title description season budget difficulty'
        })
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await Favorite.countDocuments(query);

      return {
        favorites,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des favoris', error);
      throw error;
    }
  }

  // Mettre à jour un favori
  static async updateFavorite(userId, favoriteId, updateData) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Vérifier la propriété du favori
      const favorite = await Favorite.findOne({ 
        _id: favoriteId, 
        userId 
      });

      if (!favorite) {
        throw new Error('Favori non trouvé ou non autorisé');
      }

      // Mettre à jour le favori
      const updatedFavorite = await Favorite.findByIdAndUpdate(
        favoriteId, 
        { $set: updateData },
        { 
          new: true, 
          runValidators: true,
          session 
        }
      ).populate({
        path: 'tripId',
        select: 'title description season budget difficulty'
      });

      await session.commitTransaction();

      logger.info(`Favori mis à jour: ${favoriteId} par l'utilisateur ${userId}`);
      return updatedFavorite;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Erreur lors de la mise à jour du favori', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Supprimer un favori
  static async removeFavorite(userId, favoriteId) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Supprimer le favori
      const deletedFavorite = await Favorite.findOneAndDelete({ 
        _id: favoriteId, 
        userId 
      }, { session });

      if (!deletedFavorite) {
        throw new Error('Favori non trouvé ou non autorisé');
      }

      await session.commitTransaction();

      logger.info(`Favori supprimé: ${favoriteId} par l'utilisateur ${userId}`);
      return deletedFavorite;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Erreur lors de la suppression du favori', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Rechercher des favoris avec des filtres
  static async searchFavorites(userId, searchOptions) {
    const { 
      customTags,
      priority,
      plannedDateFrom,
      plannedDateTo,
      limit = 20,
      page = 1
    } = searchOptions;

    try {
      const query = { userId };

      // Filtres optionnels
      if (customTags) {
        query.customTags = { $in: customTags };
      }

      if (priority) {
        query.priority = priority;
      }

      if (plannedDateFrom || plannedDateTo) {
        query.plannedDate = {};
        if (plannedDateFrom) query.plannedDate.$gte = new Date(plannedDateFrom);
        if (plannedDateTo) query.plannedDate.$lte = new Date(plannedDateTo);
      }

      const favorites = await Favorite.find(query)
        .populate({
          path: 'tripId',
          select: 'title description season budget difficulty'
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await Favorite.countDocuments(query);

      return {
        favorites,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Erreur lors de la recherche de favoris', error);
      throw error;
    }
  }
}

module.exports = FavoriteService;