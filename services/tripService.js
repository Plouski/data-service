const Trip = require('../models/Trip');
const Subscription = require('../models/Subscription');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

class TripService {
  // Créer un nouveau trip
  static async createTrip(userId, tripData) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      // Vérifier les limites de l'abonnement
      const subscription = await Subscription.findActiveSubscription(userId);
      if (!subscription) {
        throw new Error('Aucun abonnement actif');
      }

      // Compter les trips existants
      const tripCount = await Trip.countDocuments({ userId });
      if (tripCount >= subscription.features.maxTrips) {
        throw new Error('Limite de trips atteinte pour votre abonnement');
      }

      // Créer le trip
      const newTrip = new Trip({
        ...tripData,
        userId
      });

      await newTrip.save({ session });

      await session.commitTransaction();
      
      logger.info(`Nouveau trip créé: ${newTrip._id} pour l'utilisateur ${userId}`);
      return newTrip;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Erreur lors de la création du trip', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Récupérer les trips d'un utilisateur
  static async getUserTrips(userId, options = {}) {
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

      const trips = await Trip.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await Trip.countDocuments(query);

      return {
        trips,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des trips', error);
      throw error;
    }
  }

  // Mettre à jour un trip
  static async updateTrip(userId, tripId, updateData) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Vérifier la propriété du trip
      const trip = await Trip.findOne({ 
        _id: tripId, 
        userId 
      });

      if (!trip) {
        throw new Error('Trip non trouvé ou non autorisé');
      }

      // Mettre à jour le trip
      const updatedTrip = await Trip.findByIdAndUpdate(
        tripId, 
        { $set: updateData },
        { 
          new: true, 
          runValidators: true,
          session 
        }
      );

      await session.commitTransaction();

      logger.info(`Trip mis à jour: ${tripId} par l'utilisateur ${userId}`);
      return updatedTrip;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Erreur lors de la mise à jour du trip', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Supprimer un trip
  static async deleteTrip(userId, tripId) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Supprimer le trip
      const deletedTrip = await Trip.findOneAndDelete({ 
        _id: tripId, 
        userId 
      }, { session });

      if (!deletedTrip) {
        throw new Error('Trip non trouvé ou non autorisé');
      }

      await session.commitTransaction();

      logger.info(`Trip supprimé: ${tripId} par l'utilisateur ${userId}`);
      return deletedTrip;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Erreur lors de la suppression du trip', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Rechercher des trips publics
  static async searchPublicTrips(searchOptions) {
    const { 
      query = '', 
      season,
      minBudget, 
      maxBudget, 
      difficulty,
      limit = 20,
      page = 1
    } = searchOptions;

    try {
      // Construction de la requête
      const searchQuery = {
        isPublic: true,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $regex: query, $options: 'i' } }
        ]
      };

      // Filtres additionnels
      if (season) searchQuery.season = season;
      if (difficulty) searchQuery.difficulty = difficulty;
      
      if (minBudget || maxBudget) {
        searchQuery['budget.amount'] = {};
        if (minBudget) searchQuery['budget.amount'].$gte = minBudget;
        if (maxBudget) searchQuery['budget.amount'].$lte = maxBudget;
      }

      // Récupération des trips
      const trips = await Trip.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-__v');

      // Compter le nombre total de résultats
      const total = await Trip.countDocuments(searchQuery);

      return {
        trips,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Erreur lors de la recherche de trips publics', error);
      throw error;
    }
  }

  // Récupérer les détails d'un trip spécifique
  static async getTripDetails(tripId, userId) {
    try {
      const trip = await Trip.findOne({
        _id: tripId,
        $or: [
          { userId },  // Le propriétaire peut toujours voir
          { isPublic: true }  // Ou le trip est public
        ]
      });

      if (!trip) {
        throw new Error('Trip non trouvé ou non autorisé');
      }

      return trip;
    } catch (error) {
      logger.error('Erreur lors de la récupération des détails du trip', error);
      throw error;
    }
  }
}

module.exports = TripService;