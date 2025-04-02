const express = require('express');
const { body, query, param } = require('express-validator');
const SubscriptionController = require('../controllers/subscriptionController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();

// Validation pour la mise à jour de l'abonnement
const updateSubscriptionValidation = [
  body('plan')
    .notEmpty().withMessage('Le plan est requis')
    .isIn(['free', 'standard', 'premium', 'enterprise'])
    .withMessage('Plan d\'abonnement invalide'),
  body('paymentMethod')
    .optional()
    .isString()
    .isLength({ max: 100 }).withMessage('Méthode de paiement trop longue')
];

// Validation pour la réactivation de l'abonnement
const reactivateSubscriptionValidation = [
  body('plan')
    .notEmpty().withMessage('Le plan est requis')
    .isIn(['free', 'standard', 'premium', 'enterprise'])
    .withMessage('Plan d\'abonnement invalide'),
  body('paymentMethod')
    .optional()
    .isString()
    .isLength({ max: 100 }).withMessage('Méthode de paiement trop longue')
];

// Routes protégées nécessitant une authentification
router.get(
  '/current', 
  authMiddleware,
  SubscriptionController.getCurrentSubscription
);

router.put(
  '/', 
  authMiddleware,
  updateSubscriptionValidation,
  validateRequest,
  SubscriptionController.updateSubscription
);

router.delete(
  '/', 
  authMiddleware,
  SubscriptionController.cancelSubscription
);

router.post(
  '/reactivate', 
  authMiddleware,
  reactivateSubscriptionValidation,
  validateRequest,
  SubscriptionController.reactivateSubscription
);

router.get(
  '/history', 
  authMiddleware,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('page').optional().isInt({ min: 1 }),
    query('status').optional().isIn(['active', 'expired', 'canceled', 'pending'])
  ],
  validateRequest,
  SubscriptionController.getSubscriptionHistory
);

router.get(
  '/features', 
  authMiddleware,
  SubscriptionController.checkAvailableFeatures
);

module.exports = router;