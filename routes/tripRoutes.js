const express = require('express');
const { body, param, query } = require('express-validator');
const TripController = require('../controllers/tripController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();

// Validations pour la création de trip
const createTripValidation = [
  body('title')
    .notEmpty().withMessage('Le titre est requis')
    .isLength({ max: 100 }).withMessage('Le titre ne peut pas dépasser 100 caractères'),
  body('description')
    .optional()
    .isLength({ max: 1000 }).withMessage('La description ne peut pas dépasser 1000 caractères'),
  body('season')
    .optional()
    .isIn(['printemps', 'été', 'automne', 'hiver']).withMessage('Saison invalide'),
  body('steps')
    .optional()
    .isArray().withMessage('Les étapes doivent être un tableau'),
  body('steps.*.location.coordinates')
    .optional()
    .isArray().withMessage('Les coordonnées doivent être un tableau')
    .custom(coords => coords.length === 2).withMessage('Les coordonnées doivent contenir [longitude, latitude]'),
  body('budget.amount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Le budget doit être un nombre positif'),
  body('difficulty')
    .optional()
    .isIn(['facile', 'moyen', 'difficile', 'expert']).withMessage('Difficulté invalide'),
  body('tags')
    .optional()
    .isArray().withMessage('Les tags doivent être un tableau'),
  body('isPublic')
    .optional()
    .isBoolean().withMessage('isPublic doit être un booléen')
];

// Routes protégées nécessitant une authentification
router.post(
  '/', 
  authMiddleware,
  createTripValidation,
  validateRequest,
  TripController.createTrip
);

router.get(
  '/', 
  authMiddleware,
  TripController.getUserTrips
);

router.get(
  '/public', 
  [
    query('query').optional().isString(),
    query('season').optional().isIn(['printemps', 'été', 'automne', 'hiver']),
    query('minBudget').optional().isFloat({ min: 0 }),
    query('maxBudget').optional().isFloat({ min: 0 }),
    query('difficulty').optional().isIn(['facile', 'moyen', 'difficile', 'expert']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('page').optional().isInt({ min: 1 })
  ],
  validateRequest,
  TripController.searchPublicTrips
);

router.get(
  '/statistics',
  authMiddleware,
  TripController.getTripStatistics
);

router.get(
  '/:id', 
  authMiddleware,
  [
    param('id').isMongoId().withMessage('ID de trip invalide')
  ],
  validateRequest,
  TripController.getTripDetails
);

router.put(
  '/:id', 
  authMiddleware,
  [
    body('title')
      .optional()
      .notEmpty().withMessage('Le titre ne peut pas être vide')
      .isLength({ max: 100 }).withMessage('Le titre ne peut pas dépasser 100 caractères'),
    body('description')
      .optional()
      .isLength({ max: 1000 }).withMessage('La description ne peut pas dépasser 1000 caractères'),
    body('season')
      .optional()
      .isIn(['printemps', 'été', 'automne', 'hiver']).withMessage('Saison invalide'),
    body('difficulty')
      .optional()
      .isIn(['facile', 'moyen', 'difficile', 'expert']).withMessage('Difficulté invalide')
  ],
  validateRequest,
  TripController.updateTrip
);

router.delete(
  '/:id', 
  authMiddleware,
  TripController.deleteTrip
);

// Routes supplémentaires
router.post(
  '/:id/clone',
  authMiddleware,
  [
    param('id').isMongoId().withMessage('ID de trip invalide')
  ],
  validateRequest,
  TripController.cloneTrip
);

router.post(
  '/:id/steps',
  authMiddleware,
  [
    param('id').isMongoId().withMessage('ID de trip invalide'),
    body('steps').isArray().withMessage('Les étapes doivent être un tableau'),
    body('steps.*.location.coordinates')
      .isArray().withMessage('Les coordonnées doivent être un tableau')
      .custom(coords => coords.length === 2).withMessage('Les coordonnées doivent contenir [longitude, latitude]')
  ],
  validateRequest,
  TripController.addTripSteps
);

router.get(
  '/:id/export',
  authMiddleware,
  [
    param('id').isMongoId().withMessage('ID de trip invalide'),
    query('format').optional().isIn(['json', 'csv']).withMessage('Format invalide')
  ],
  validateRequest,
  TripController.exportTrip
);

module.exports = router;