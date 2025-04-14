const Trip = require('../models/Trip');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

class TripService {
  // Créer un nouveau trip (admin uniquement)
  static async createTrip(data) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const newTrip = new Trip(data);
      await newTrip.save({ session });
      await session.commitTransaction();

      logger.info(`Nouveau trip créé: ${newTrip._id} par l'utilisateur ${data.userId}`);
      return newTrip;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Erreur lors de la création du trip', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Mettre à jour un trip (admin uniquement)
  static async updateTrip(userId, tripId, updateData) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const trip = await Trip.findOne({ _id: tripId });
      if (!trip) throw new Error('Trip non trouvé');

      const updatedTrip = await Trip.findByIdAndUpdate(
        tripId,
        { $set: updateData },
        { new: true, runValidators: true, session }
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

  // Supprimer un trip (admin uniquement)
  static async deleteTrip(userId, tripId) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const deletedTrip = await Trip.findOneAndDelete({ _id: tripId }, { session });
      if (!deletedTrip) throw new Error('Trip non trouvé');

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

  // Récupérer les détails d'un trip (public, sauf contenu premium)
  static async getTripDetails(tripId, userId, userRole = 'visitor') {
    try {
      const trip = await Trip.findById(tripId);
      if (!trip) throw new Error('Trip non trouvé ou non autorisé');

      const isAdmin = userRole === 'admin';
      const isPremiumUser = userRole === 'premium';

      const canAccessPremium = isAdmin || isPremiumUser || (trip.userId.toString() === userId);

      const tripData = trip.toObject();
      tripData.userAccess = { canAccessPremium, userRole };

      if (trip.isPremium && !canAccessPremium) {
        // Masquer les détails premium
        tripData.itinerary = tripData.itinerary?.map(step => ({
          day: step.day,
          title: step.title,
          description: step.description,
          overnight: step.overnight
        })) || [];
        tripData.recommendations = undefined;
        tripData.detailedMaps = undefined;
        tripData.notice = "Certaines informations sont réservées aux utilisateurs premium.";
        tripData.callToAction = "Abonnez-vous pour débloquer l'itinéraire complet, la carte interactive et les conseils d'expert.";
      }

      return tripData;
    } catch (error) {
      logger.error('Erreur lors de la récupération des détails du trip', error);
      throw error;
    }
  }

  // Rechercher des trips publics
  static async searchPublicTrips(searchOptions) {
    const {
      query = '',
      season,
      country,
      duration,
      tags = [],
      minBudget,
      maxBudget,
      difficulty,
      onlyPremium = false,
      adminView = false, // ✅ ajouter ici
      limit = 20,
      page = 1
    } = searchOptions;

    const searchQuery = {
      ...(adminView ? {} : { isPublic: true }), // ✅ clé ici
      ...(onlyPremium ? { isPremium: true } : {}),
      ...(season ? { bestSeason: season } : {}),
      ...(country ? { country } : {}),
      ...(duration ? { duration: parseInt(duration) } : {}),
      ...(difficulty ? { difficulty } : {})
    };

    if (!adminView) {
      searchQuery.isPublic = true;
    }    

    // Recherche textuelle dans certains champs
    if (query.trim()) {
      searchQuery.$or = [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } }
      ];
    }

    // Budget (entre min et max)
    if (minBudget || maxBudget) {
      searchQuery['budget.amount'] = {};
      if (minBudget) searchQuery['budget.amount'].$gte = parseInt(minBudget);
      if (maxBudget) searchQuery['budget.amount'].$lte = parseInt(maxBudget);
    }

    // Filtre par tags
    if (tags.length > 0) {
      searchQuery.tags = { $in: tags };
    }

    const trips = await Trip.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await Trip.countDocuments(searchQuery);

    return {
      trips,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Récupérer tous les trips d’un utilisateur
  static async getUserTrips(userId, options = {}) {
    const { limit = 50, page = 1, sort = { createdAt: -1 }, filters = {} } = options;

    try {
      const query = { userId, ...filters };

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

  static async incrementViews(tripId) {
    try {
      const updated = await Trip.findByIdAndUpdate(
        tripId,
        { $inc: { views: 1 } }, // incrementation MongoDB
        { new: true }
      )
      return updated
    } catch (error) {
      logger.error("Erreur lors de l'incrémentation des vues", error)
      throw new Error("Impossible d'enregistrer la vue")
    }
  }

  
  
}

module.exports = TripService;
