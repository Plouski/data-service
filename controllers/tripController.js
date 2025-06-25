const Trip = require("../models/Trip");
const { validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");
const logger = require("../utils/logger");

class TripController {
  static async getPublicRoadtrips(req, res) {
    try {
      const trips = await Trip.find({ isPublished: true });
      res.status(200).json({ trips });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur", error });
    }
  }

  static async getPopularRoadtrips(req, res) {
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

      const tripData = trip.toObject();

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

}

module.exports = TripController;
