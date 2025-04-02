const TripService = require('../services/tripService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const sanitizeHtml = require('sanitize-html');

class TripController {
  // Créer un nouveau trip
  static async createTrip(req, res) {
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
      const sanitizedTripData = {
        title: sanitizeHtml(req.body.title),
        description: sanitizeHtml(req.body.description || ''),
        season: req.body.season,
        steps: req.body.steps ? req.body.steps.map(step => ({
          location: {
            type: 'Point',
            coordinates: step.location.coordinates,
            address: sanitizeHtml(step.location.address || '').trim()
          },
          description: sanitizeHtml(step.description || ''),
          expectedDuration: step.expectedDuration,
          order: step.order
        })) : [],
        budget: req.body.budget,
        difficulty: req.body.difficulty,
        tags: (req.body.tags || []).map(tag => sanitizeHtml(tag)),
        isPublic: req.body.isPublic || false,
        estimatedTotalDistance: req.body.estimatedTotalDistance,
        estimatedDuration: req.body.estimatedDuration
      };

      // Créer le trip via le service
      const newTrip = await TripService.createTrip(req.user.id, sanitizedTripData);

      // Journaliser la création du trip
      logger.info(`Nouveau trip créé: ${newTrip._id} par ${req.user.email}`);

      // Répondre avec le trip créé
      res.status(201).json(newTrip);
    } catch (error) {
      logger.error('Erreur lors de la création du trip', error);
      
      // Gestion des erreurs spécifiques
      if (error.message.includes('Limite de trips atteinte')) {
        return res.status(403).json({ 
          message: 'Limite de trips atteinte pour votre abonnement' 
        });
      }

      res.status(500).json({ 
        message: 'Erreur interne lors de la création du trip',
        error: error.message 
      });
    }
  }

  // Récupérer les trips de l'utilisateur
  static async getUserTrips(req, res) {
    try {
      const { 
        limit, 
        page, 
        season, 
        difficulty 
      } = req.query;

      const filters = {};
      if (season) filters.season = season;
      if (difficulty) filters.difficulty = difficulty;

      const trips = await TripService.getUserTrips(req.user.id, {
        limit: parseInt(limit) || 50,
        page: parseInt(page) || 1,
        filters
      });

      res.json(trips);
    } catch (error) {
      logger.error('Erreur lors de la récupération des trips', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des trips',
        error: error.message 
      });
    }
  }

  // Mettre à jour un trip
  static async updateTrip(req, res) {
    try {
      // Validation des erreurs de requête
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          errors: errors.array(),
          message: 'Erreurs de validation des données' 
        });
      }

      const tripId = req.params.id;

      // Nettoyer les données de mise à jour
      const updateData = {
        title: req.body.title ? sanitizeHtml(req.body.title) : undefined,
        description: req.body.description ? sanitizeHtml(req.body.description) : undefined,
        season: req.body.season,
        steps: req.body.steps ? req.body.steps.map(step => ({
          location: {
            type: 'Point',
            coordinates: step.location.coordinates,
            address: sanitizeHtml(step.location.address || 'Adresse non spécifiée').trim()
          },
          description: sanitizeHtml(step.description || ''),
          expectedDuration: step.expectedDuration,
          order: step.order
        })) : undefined,
        budget: req.body.budget,
        difficulty: req.body.difficulty,
        tags: req.body.tags ? req.body.tags.map(tag => sanitizeHtml(tag)) : undefined,
        isPublic: req.body.isPublic,
        estimatedTotalDistance: req.body.estimatedTotalDistance,
        estimatedDuration: req.body.estimatedDuration
      };

      // Filtrer les propriétés undefined
      Object.keys(updateData).forEach(key => 
        updateData[key] === undefined && delete updateData[key]
      );

      // Mettre à jour le trip
      const updatedTrip = await TripService.updateTrip(
        req.user.id, 
        tripId, 
        updateData
      );

      logger.info(`Trip mis à jour: ${tripId} par ${req.user.email}`);
      res.json(updatedTrip);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du trip', error);
      res.status(500).json({ 
        message: 'Erreur lors de la mise à jour du trip',
        error: error.message 
      });
    }
  }

  // Supprimer un trip
  static async deleteTrip(req, res) {
    try {
      const tripId = req.params.id;

      await TripService.deleteTrip(req.user.id, tripId);

      logger.info(`Trip supprimé: ${tripId} par ${req.user.email}`);
      res.status(200).json({ 
        message: 'Trip supprimé avec succès' 
      });
    } catch (error) {
      logger.error('Erreur lors de la suppression du trip', error);
      res.status(500).json({ 
        message: 'Erreur lors de la suppression du trip',
        error: error.message 
      });
    }
  }

  // Rechercher des trips publics
  static async searchPublicTrips(req, res) {
    try {
      const { 
        query, 
        season, 
        minBudget, 
        maxBudget, 
        difficulty,
        limit,
        page
      } = req.query;

      const searchResults = await TripService.searchPublicTrips({
        query,
        season,
        minBudget: parseFloat(minBudget),
        maxBudget: parseFloat(maxBudget),
        difficulty,
        limit: parseInt(limit) || 20,
        page: parseInt(page) || 1
      });

      res.json(searchResults);
    } catch (error) {
      logger.error('Erreur lors de la recherche de trips publics', error);
      res.status(500).json({ 
        message: 'Erreur lors de la recherche de trips',
        error: error.message 
      });
    }
  }

  // Obtenir les détails d'un trip spécifique
  static async getTripDetails(req, res) {
    try {
      const tripId = req.params.id;

      const trip = await TripService.getTripDetails(
        tripId, 
        req.user.id
      );

      res.json(trip);
    } catch (error) {
      logger.error('Erreur lors de la récupération des détails du trip', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des détails du trip',
        error: error.message 
      });
    }
  }

  // Générer des statistiques de trips
  static async getTripStatistics(req, res) {
    try {
      const userId = req.user.id;

      // Calculer diverses statistiques sur les trips de l'utilisateur
      const statistics = await TripService.generateTripStatistics(userId);

      res.json(statistics);
    } catch (error) {
      logger.error('Erreur lors de la génération des statistiques de trips', error);
      res.status(500).json({ 
        message: 'Erreur lors de la génération des statistiques',
        error: error.message 
      });
    }
  }

  // Cloner un trip existant
  static async cloneTrip(req, res) {
    try {
      const tripId = req.params.id;
      const userId = req.user.id;

      // Vérifier les droits et créer une copie du trip
      const clonedTrip = await TripService.cloneTrip(userId, tripId);

      logger.info(`Trip cloné: ${tripId} par ${req.user.email}`);
      res.status(201).json(clonedTrip);
    } catch (error) {
      logger.error('Erreur lors du clonage du trip', error);
      
      if (error.message.includes('Limite de trips atteinte')) {
        return res.status(403).json({ 
          message: 'Limite de trips atteinte pour votre abonnement' 
        });
      }

      res.status(500).json({ 
        message: 'Erreur lors du clonage du trip',
        error: error.message 
      });
    }
  }

  // Ajouter des étapes à un trip existant
  static async addTripSteps(req, res) {
    try {
      // Validation des erreurs de requête
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          errors: errors.array(),
          message: 'Erreurs de validation des données' 
        });
      }

      const tripId = req.params.id;
      const userId = req.user.id;

      // Nettoyer et valider les nouvelles étapes
      const newSteps = req.body.steps.map(step => ({
        location: {
          type: 'Point',
          coordinates: step.coordinates,
          address: sanitizeHtml(step.address)
        },
        description: sanitizeHtml(step.description || ''),
        expectedDuration: step.expectedDuration,
        order: step.order
      }));

      // Ajouter les étapes
      const updatedTrip = await TripService.addTripSteps(
        userId, 
        tripId, 
        newSteps
      );

      logger.info(`Étapes ajoutées au trip: ${tripId} par ${req.user.email}`);
      res.json(updatedTrip);
    } catch (error) {
      logger.error('Erreur lors de l\'ajout d\'étapes au trip', error);
      res.status(500).json({ 
        message: 'Erreur lors de l\'ajout d\'étapes',
        error: error.message 
      });
    }
  }

  // Exporter les données d'un trip
  static async exportTrip(req, res) {
    try {
      const tripId = req.params.id;
      const userId = req.user.id;
      const format = req.query.format || 'json';

      // Générer l'export
      const exportData = await TripService.exportTrip(
        userId, 
        tripId, 
        format
      );

      // Définir les en-têtes pour le téléchargement
      res.setHeader(
        'Content-Disposition', 
        `attachment; filename=trip_${tripId}.${format}`
      );
      res.setHeader(
        'Content-Type', 
        format === 'csv' ? 'text/csv' : 'application/json'
      );

      logger.info(`Trip exporté: ${tripId} par ${req.user.email}`);
      res.send(exportData);
    } catch (error) {
      logger.error('Erreur lors de l\'export du trip', error);
      res.status(500).json({ 
        message: 'Erreur lors de l\'export du trip',
        error: error.message 
      });
    }
  }
}

module.exports = TripController;