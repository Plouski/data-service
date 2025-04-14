const TripService = require("../services/tripService");
const Trip = require("../models/Trip");
const Favorite = require("../models/Favorite");
const { validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");
const logger = require("../utils/logger");

class TripController {
  // GET /roadtrips
  static async getRoadtrips(req, res) {
    try {
      const { search, country, duration, tags, budget, bestSeason, onlyPremium, page = 1, limit = 20, adminView = "false" } = req.query;

      const filters = {
        query: search || "",
        season: bestSeason,
        country,
        duration,
        minBudget: budget ? parseInt(budget) : undefined,
        onlyPremium: onlyPremium === "true",
        tags,
        limit: parseInt(limit),
        page: parseInt(page),
        adminView: adminView === "true", // ✅ ici !
      };

      logger.debug("Filtres appliqués", filters);

      const result = await TripService.searchPublicTrips(filters);

      res.status(200).json(result);
    } catch (error) {
      logger.error("Erreur getRoadtrips", error);
      res.status(500).json({ message: "Erreur récupération des roadtrips", error: error.message });
    }
  }

  static async getPublicTrips(req, res) {
    try {
      const trips = await Trip.find({ isPublished: true })
      res.status(200).json({ trips })
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur", error })
    }
  }

  // GET /roadtrips/:id
  static async getRoadtripById(req, res) {
    try {
      const trip = await TripService.getTripDetails(
        req.params.id,
        req.user?.userId || null,
        req.user?.role || "user"
      );

      return res.status(200).json({ success: true, data: trip });
    } catch (error) {
      logger.error("Erreur lors de la récupération du roadtrip", error);
      return res.status(404).json({
        success: false,
        message: error.message || "Roadtrip non trouvé",
      });
    }
  }

  // POST /roadtrips (admin only)
  static async createTrip(req, res) {
    try {

      if (!req.user) {
        return res.status(401).json({ message: "Authentification requise" });
      }

      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Accès refusé - Droits administrateur requis" });
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

      logger.info(`Tentative de création d'un roadtrip par l'utilisateur ${req.user.userId}`);

      const trip = await TripService.createTrip(data);
      res.status(201).json(trip);
    } catch (error) {
      logger.error("Erreur création roadtrip", error);
      res.status(500).json({ message: "Erreur création", error: error.message });
    }
  }

  // PUT /roadtrips/:id (admin only)
  static async updateTrip(req, res) {
    try {

      if (!req.user) {
        return res.status(401).json({ message: "Authentification requise" });
      }

      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Accès refusé - Droits administrateur requis" });
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

      logger.info(`Tentative de mise à jour du roadtrip ${req.params.id} par l'utilisateur ${req.user.userId}`);

      const updated = await TripService.updateTrip(req.user.userId, req.params.id, updateData);
      res.status(200).json(updated);
    } catch (error) {
      logger.error("Erreur updateTrip", error);
      res.status(500).json({ message: "Erreur mise à jour", error: error.message });
    }
  }

  // DELETE /roadtrips/:id (admin only)
  static async deleteTrip(req, res) {
    try {

      if (!req.user) {
        return res.status(401).json({ message: "Authentification requise" });
      }

      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Accès refusé - Droits administrateur requis" });
      }

      logger.info(`Tentative de suppression du roadtrip ${req.params.id} par l'utilisateur ${req.user.userId}`);

      await TripService.deleteTrip(req.user.userId, req.params.id);
      res.status(200).json({ message: "Supprimé avec succès" });
    } catch (error) {
      logger.error("Erreur deleteTrip", error);
      res.status(500).json({ message: "Erreur suppression", error: error.message });
    }
  }

  static async getRoadtripById(req, res) {
    try {
      const trip = await TripService.getTripDetails(
        req.params.id,
        req.user?.userId || null,
        req.user?.role || "user"
      );

      return res.status(200).json({ success: true, data: trip });
    } catch (error) {
      logger.error("Erreur lors de la récupération du roadtrip", error);
      return res.status(404).json({
        success: false,
        message: error.message || "Roadtrip non trouvé",
      });
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

      if (!trip) {
        return res.status(404).json({ message: "Roadtrip non trouvé" });
      }

      res.status(200).json({ success: true, views: trip.views });
    } catch (error) {
      console.error("Erreur incrementViewCount:", error);
      res.status(500).json({ message: "Erreur interne", error: error.message });
    }
  }

  static async toggleFavorite(req, res) {
    try {
      const userId = req.user?.userId; // 👈 PAS `id`
      const tripId = req.params?.id;
  
      if (!userId || !tripId) {
        console.warn("❌ userId ou tripId manquant :", { userId, tripId });
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
      console.error("userId :", userId);

      const favorites = await Favorite.find({ userId }).populate({
        path: "tripId",
        select: "title description country region image duration budget tags isPremium"
      })

      const roadtrips = favorites.map(fav => ({
        ...fav.tripId.toObject(), // 👈 renomme tripId → trip
        _favoriteId: fav._id,
        notes: fav.notes,
        priority: fav.priority
      }));
      return res.status(200).json({ roadtrips })
    } catch (error) {
      console.error("Erreur getFavoritesForUser :", error)
      res.status(500).json({ message: "Erreur serveur" })
    }
  }

}

module.exports = TripController;