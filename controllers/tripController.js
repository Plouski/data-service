const Trip = require("../models/Trip");
const Favorite = require("../models/Favorite");
const { validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");
const logger = require("../utils/logger");

class TripController {
  static async getRoadtrips(req, res) {
    try {
      const trips = await Trip.find({ isPublished: true });
      res.status(200).json({ trips });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur", error });
    }
  }

  static async getPopularTrips(req, res) {
    try {
      const trips = await Trip.find({ isPublished: true })
        .sort({ views: -1 })
        .limit(3);
  
      if (!trips || trips.length === 0) {
        return res.status(200).json({ trips: [] });
      }
  
      res.status(200).json({ trips });
    } catch (error) {
      console.error("Erreur lors de la récupération des roadtrips populaires :", error);
      res.status(500).json({ message: "Erreur serveur", error });
    }
  }  

  static async getRoadtripById(req, res) {
    try {
      const trip = await Trip.findById(req.params.id);

      if (!trip) throw new Error("Roadtrip non trouvé");

      const userRole = req.user?.role || "user";
      const userId = req.user?.userId || null;
      const isAdmin = userRole === "admin";
      const isPremiumUser = userRole === "premium";
      const canAccessPremium = isAdmin || isPremiumUser || (trip.userId.toString() === userId);

      const tripData = trip.toObject();
      tripData.userAccess = { canAccessPremium, userRole };

      if (trip.isPremium && !canAccessPremium) {
        tripData.itinerary = tripData.itinerary?.map(step => ({
          day: step.day,
          title: step.title,
          description: step.description,
          overnight: step.overnight
        })) || [];
        tripData.notice = "Certaines informations sont réservées aux utilisateurs premium.";
        tripData.callToAction = "Abonnez-vous pour débloquer l'itinéraire complet, la carte interactive et les conseils d'expert.";
      }

      return res.status(200).json({ success: true, data: tripData });
    } catch (error) {
      logger.error("Erreur lors de la récupération du roadtrip", error);
      return res.status(404).json({
        success: false,
        message: error.message || "Roadtrip non trouvé",
      });
    }
  }

  static async createTrip(req, res) {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Accès refusé - Admin requis" });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const data = {
        userId: req.user.userId,
        title: sanitizeHtml(req.body.title),
        image: req.body.image || "/placeholder.svg",
        country: sanitizeHtml(req.body.country || ""),
        description: sanitizeHtml(req.body.description || ""),
        duration: parseInt(req.body.duration) || 7,
        budget: {
          amount: parseFloat(req.body.budget?.amount || req.body.budget || 1000),
          currency: sanitizeHtml(req.body.budget?.currency || "EUR"),
        },
        bestSeason: sanitizeHtml(req.body.bestSeason || ""),
        isPremium: Boolean(req.body.isPremium),
        isPublished: Boolean(req.body.isPublished),
        tags: (req.body.tags || []).map((tag) => sanitizeHtml(tag)),
        pointsOfInterest: (req.body.pointsOfInterest || []).map((poi) => ({
          name: sanitizeHtml(poi.name),
          description: sanitizeHtml(poi.description),
          image: poi.image || "/placeholder.svg",
        })),
        itinerary: (req.body.itinerary || []).map((step) => ({
          day: parseInt(step.day),
          title: sanitizeHtml(step.title),
          description: sanitizeHtml(step.description),
          overnight: Boolean(step.overnight),
        })),
      };

      const trip = new Trip(data);
      await trip.save();

      res.status(201).json(trip);
    } catch (error) {
      logger.error("Erreur création roadtrip", error);
      res.status(500).json({ message: "Erreur création", error: error.message });
    }
  }

  static async updateTrip(req, res) {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Accès refusé - Admin requis" });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updateData = {
        userId: req.user.userId,
        title: req.body.title && sanitizeHtml(req.body.title),
        image: req.body.image,
        country: req.body.country && sanitizeHtml(req.body.country),
        description: req.body.description && sanitizeHtml(req.body.description),
        duration: req.body.duration && parseInt(req.body.duration),
        bestSeason: req.body.bestSeason && sanitizeHtml(req.body.bestSeason),
        isPremium: typeof req.body.isPremium !== "undefined" ? Boolean(req.body.isPremium) : undefined,
        isPublished: typeof req.body.isPublished !== "undefined" ? Boolean(req.body.isPublished) : undefined,
        budget: req.body.budget ? {
          amount: parseFloat(req.body.budget?.amount || req.body.budget),
          currency: sanitizeHtml(req.body.budget?.currency || "EUR"),
        } : undefined,
        tags: req.body.tags && req.body.tags.map((tag) => sanitizeHtml(tag)),
        pointsOfInterest: req.body.pointsOfInterest?.map((poi) => ({
          name: sanitizeHtml(poi.name),
          description: sanitizeHtml(poi.description),
          image: poi.image || "/placeholder.svg",
        })),
        itinerary: req.body.itinerary?.map((step) => ({
          day: parseInt(step.day),
          title: sanitizeHtml(step.title),
          description: sanitizeHtml(step.description),
          overnight: Boolean(step.overnight),
        })),
      };

      Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

      const updated = await Trip.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      res.status(200).json(updated);
    } catch (error) {
      logger.error("Erreur updateTrip", error);
      res.status(500).json({ message: "Erreur mise à jour", error: error.message });
    }
  }

  static async deleteTrip(req, res) {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Accès refusé - Admin requis" });
      }

      await Trip.findByIdAndDelete(req.params.id);
      res.status(200).json({ message: "Supprimé avec succès" });
    } catch (error) {
      logger.error("Erreur deleteTrip", error);
      res.status(500).json({ message: "Erreur suppression", error: error.message });
    }
  }

  static async updateRoadtripStatus(req, res) {
    const { id } = req.params;
    const { isPublished } = req.body;

    if (typeof isPublished !== "boolean") {
      return res.status(400).json({ message: "Le champ 'isPublished' doit être un booléen." });
    }

    try {
      const roadtrip = await Trip.findById(id);
      if (!roadtrip) return res.status(404).json({ message: "Roadtrip non trouvé." });

      roadtrip.isPublished = isPublished;
      await roadtrip.save();

      res.status(200).json({
        message: `Roadtrip ${isPublished ? "publié" : "dépublié"} avec succès.`,
        roadtrip,
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour :", error);
      res.status(500).json({ message: "Erreur serveur lors de la mise à jour." });
    }
  }

  static async incrementViewCount(req, res) {
    try {
      const { id } = req.params;
      const trip = await Trip.findByIdAndUpdate(
        id,
        { $inc: { views: 1 } },
        { new: true }
      );
      if (!trip) return res.status(404).json({ message: "Roadtrip non trouvé" });
      res.status(200).json({ success: true, views: trip.views });
    } catch (error) {
      console.error("Erreur incrementViewCount:", error);
      res.status(500).json({ message: "Erreur interne", error: error.message });
    }
  }

  static async toggleFavorite(req, res) {
    try {
      const userId = req.user?.userId;
      const tripId = req.params?.id;

      if (!userId || !tripId) {
        return res.status(400).json({ message: "userId ou tripId manquant" });
      }

      const existing = await Favorite.findOne({ userId, tripId });
      if (existing) {
        await Favorite.deleteOne({ _id: existing._id });
        return res.status(200).json({ message: "Retiré des favoris", favorited: false });
      }

      const favorite = new Favorite({ userId, tripId });
      await favorite.save();

      return res.status(201).json({ message: "Ajouté aux favoris", favorited: true });
    } catch (error) {
      console.error("Erreur toggleFavorite :", error);
      res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
  }

  static async getFavoritesForUser(req, res) {
    try {
      const userId = req.user.userId;

      const favorites = await Favorite.find({ userId }).populate({
        path: "tripId",
        select: "title description country region image duration budget tags isPremium"
      });

      const roadtrips = favorites.map(fav => ({
        ...fav.tripId.toObject(),
        _favoriteId: fav._id,
        notes: fav.notes,
        priority: fav.priority
      }));

      return res.status(200).json({ roadtrips });
    } catch (error) {
      console.error("Erreur getFavoritesForUser :", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
}

module.exports = TripController;
