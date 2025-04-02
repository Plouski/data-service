const FavoriteService = require('../services/favoriteService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const sanitizeHtml = require('sanitize-html');

class FavoriteController {
  // Ajouter un trip aux favoris
  static async addToFavorites(req, res) {
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
      const sanitizedData = {
        tripId: req.body.tripId,
        notes: req.body.notes ? sanitizeHtml(req.body.notes, {
          allowedTags: [],
          allowedAttributes: {}
        }) : '',
        customTags: (req.body.customTags || []).map(tag => 
          sanitizeHtml(tag, {
            allowedTags: [],
            allowedAttributes: {}
          })
        ),
        plannedDate: req.body.plannedDate ? new Date(req.body.plannedDate) : null,
        priority: req.body.priority || 'basse'
      };

      // Ajouter aux favoris via le service
      const newFavorite = await FavoriteService.addToFavorites(
        req.user.id, 
        sanitizedData.tripId,
        sanitizedData
      );

      // Journaliser l'ajout aux favoris
      logger.info(`Trip ajouté aux favoris: ${sanitizedData.tripId} par ${req.user.email}`);

      // Répondre avec le favori créé
      res.status(201).json(newFavorite);
    } catch (error) {
      logger.error('Erreur lors de l\'ajout aux favoris', error);
      
      // Gestion des erreurs spécifiques
      if (error.message.includes('déjà dans vos favoris')) {
        return res.status(409).json({ 
          message: 'Ce trip est déjà dans vos favoris' 
        });
      }

      res.status(500).json({ 
        message: 'Erreur interne lors de l\'ajout aux favoris',
        error: error.message 
      });
    }
  }

  // Récupérer les favoris de l'utilisateur
  static async getUserFavorites(req, res) {
    try {
      const { 
        limit, 
        page, 
        priority,
        customTags 
      } = req.query;

      // Construire les filtres
      const filters = {};
      if (priority) filters.priority = priority;
      if (customTags) {
        filters.customTags = { 
          $in: Array.isArray(customTags) ? customTags : [customTags] 
        };
      }

      const favorites = await FavoriteService.getUserFavorites(req.user.id, {
        limit: parseInt(limit) || 50,
        page: parseInt(page) || 1,
        filters
      });

      res.json(favorites);
    } catch (error) {
      logger.error('Erreur lors de la récupération des favoris', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des favoris',
        error: error.message 
      });
    }
  }

  // Mettre à jour un favori
  static async updateFavorite(req, res) {
    try {
      // Validation des erreurs de requête
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          errors: errors.array(),
          message: 'Erreurs de validation des données' 
        });
      }

      const favoriteId = req.params.id;

      // Nettoyer et préparer les données de mise à jour
      const updateData = {
        notes: req.body.notes ? sanitizeHtml(req.body.notes, {
          allowedTags: [],
          allowedAttributes: {}
        }) : undefined,
        customTags: req.body.customTags ? req.body.customTags.map(tag => 
          sanitizeHtml(tag, {
            allowedTags: [],
            allowedAttributes: {}
          })
        ) : undefined,
        plannedDate: req.body.plannedDate ? new Date(req.body.plannedDate) : undefined,
        priority: req.body.priority,
        isArchived: req.body.isArchived
      };

      // Supprimer les propriétés undefined
      Object.keys(updateData).forEach(key => 
        updateData[key] === undefined && delete updateData[key]
      );

      // Mettre à jour le favori
      const updatedFavorite = await FavoriteService.updateFavorite(
        req.user.id, 
        favoriteId, 
        updateData
      );

      logger.info(`Favori mis à jour: ${favoriteId}`);
      res.json(updatedFavorite);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du favori', error);
      res.status(500).json({ 
        message: 'Erreur lors de la mise à jour du favori',
        error: error.message 
      });
    }
  }

  // Supprimer un favori
  static async removeFavorite(req, res) {
    try {
      const favoriteId = req.params.id;

      await FavoriteService.removeFavorite(req.user.id, favoriteId);

      logger.info(`Favori supprimé: ${favoriteId}`);
      res.status(200).json({ 
        message: 'Favori supprimé avec succès' 
      });
    } catch (error) {
      logger.error('Erreur lors de la suppression du favori', error);
      res.status(500).json({ 
        message: 'Erreur lors de la suppression du favori',
        error: error.message 
      });
    }
  }

  // Rechercher des favoris
  static async searchFavorites(req, res) {
    try {
      const { 
        customTags, 
        priority,
        plannedDateFrom,
        plannedDateTo,
        limit,
        page 
      } = req.query;

      const searchResults = await FavoriteService.searchFavorites(req.user.id, {
        customTags: customTags ? (Array.isArray(customTags) ? customTags : [customTags]) : undefined,
        priority,
        plannedDateFrom,
        plannedDateTo,
        limit: parseInt(limit) || 20,
        page: parseInt(page) || 1
      });

      res.json(searchResults);
    } catch (error) {
      logger.error('Erreur lors de la recherche de favoris', error);
      res.status(500).json({ 
        message: 'Erreur lors de la recherche de favoris',
        error: error.message 
      });
    }
  }
}

module.exports = FavoriteController;