const express = require('express');
const { body, param, query } = require('express-validator');
const AiController = require('../controllers/aiController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();

// Validation pour l'enregistrement d'une interaction IA
const saveAiInteractionValidation = [
  body('input')
    .notEmpty().withMessage('L\'entrée IA est requise')
    .isLength({ max: 2000 }).withMessage('L\'entrée ne peut pas dépasser 2000 caractères'),
  body('response')
    .notEmpty().withMessage('La réponse IA est requise')
    .isLength({ max: 5000 }).withMessage('La réponse ne peut pas dépasser 5000 caractères'),
  body('category')
    .optional()
    .isIn([
      'trip_planning', 
      'destination_suggestion', 
      'itinerary_optimization', 
      'budget_advice', 
      'travel_tips', 
      'other'
    ]).withMessage('Catégorie IA invalide'),
  body('context.tripId')
    .optional()
    .isMongoId().withMessage('ID de trip invalide')
];

// Validation pour l'ajout de feedback
const addAiFeedbackValidation = [
  body('rating')
    .isInt({ min: 1, max: 5 }).withMessage('La note doit être entre 1 et 5'),
  body('comment')
    .optional()
    .isLength({ max: 500 }).withMessage('Le commentaire ne peut pas dépasser 500 caractères')
];

// Routes protégées nécessitant une authentification
router.post(
  '/', 
  authMiddleware,
  saveAiInteractionValidation,
  validateRequest,
  AiController.saveAiInteraction
);

router.get(
  '/', 
  authMiddleware,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('page').optional().isInt({ min: 1 }),
    query('category').optional().isIn([
      'trip_planning', 
      'destination_suggestion', 
      'itinerary_optimization', 
      'budget_advice', 
      'travel_tips', 
      'other'
    ]),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  AiController.getAiHistory
);

router.post(
  '/:id/feedback', 
  authMiddleware,
  [
    param('id').isMongoId().withMessage('ID d\'interaction invalide')
  ],
  addAiFeedbackValidation,
  validateRequest,
  AiController.addAiFeedback
);

router.delete(
  '/:id', 
  authMiddleware,
  [
    param('id').isMongoId().withMessage('ID d\'interaction invalide')
  ],
  validateRequest,
  AiController.deleteAiInteraction
);

module.exports = router;