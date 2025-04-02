const express = require('express');
const { body, query, param } = require('express-validator');
const FavoriteController = require('../controllers/favoriteController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();

// Validation pour l'ajout d'un favori
const addToFavoritesValidation = [
  body('tripId')
    .notEmpty().withMessage('L\'ID du trip est requis')
    .isMongoId().withMessage('ID de trip invalide'),
  body('notes')
    .optional()
    .isLength({ max: 500 }).withMessage('Les notes ne peuvent pas dépasser 500 caractères'),
  body('customTags')
    .optional()
    .isArray().withMessage('Les tags doivent être un tableau')
    .custom((tags) => {
      if (tags.some(tag => tag.length > 30)) {
        throw new Error('Un tag ne peut pas dépasser 30 caractères');
      }
      return true;
    }),
  body('plannedDate')
    .optional()
    .isISO8601().withMessage('Date invalide'),
  body('priority')
    .optional()
    .isIn(['basse', 'moyenne', 'haute']).withMessage('Priorité invalide')
];

// Validation pour la mise à jour d'un favori
const updateFavoriteValidation = [
  body('notes')
    .optional()
    .isLength({ max: 500 }).withMessage('Les notes ne peuvent pas dépasser 500 caractères'),
  body('customTags')
    .optional()
    .isArray().withMessage('Les tags doivent être un tableau')
    .custom((tags) => {
      if (tags.some(tag => tag.length > 30)) {
        throw new Error('Un tag ne peut pas dépasser 30 caractères');
      }
      return true;
    }),
  body('plannedDate')
    .optional()
    .isISO8601().withMessage('Date invalide'),
  body('priority')
    .optional()
    .isIn(['basse', 'moyenne', 'haute']).withMessage('Priorité invalide'),
  body('isArchived')
    .optional()
    .isBoolean().withMessage('isArchived doit être un booléen')
];

// Routes protégées nécessitant une authentification
router.post(
  '/', 
  authMiddleware,
  addToFavoritesValidation,
  validateRequest,
  FavoriteController.addToFavorites
);

router.get(
  '/', 
  authMiddleware,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('page').optional().isInt({ min: 1 }),
    query('priority').optional().isIn(['basse', 'moyenne', 'haute']),
    query('customTags').optional(),
  ],
  validateRequest,
  FavoriteController.getUserFavorites
);

router.get(
  '/search', 
  authMiddleware,
  [
    query('customTags').optional(),
    query('priority').optional().isIn(['basse', 'moyenne', 'haute']),
    query('plannedDateFrom').optional().isISO8601(),
    query('plannedDateTo').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('page').optional().isInt({ min: 1 })
  ],
  validateRequest,
  FavoriteController.searchFavorites
);

router.put(
  '/:id', 
  authMiddleware,
  [
    param('id').isMongoId().withMessage('ID de favori invalide')
  ],
  updateFavoriteValidation,
  validateRequest,
  FavoriteController.updateFavorite
);

router.delete(
  '/:id', 
  authMiddleware,
  [
    param('id').isMongoId().withMessage('ID de favori invalide')
  ],
  validateRequest,
  FavoriteController.removeFavorite
);

module.exports = router;