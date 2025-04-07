const express = require('express');
const { body, query, param } = require('express-validator');
const SubscriptionController = require('../controllers/subscriptionController');
const { authMiddleware, checkRole } = require('../middlewares/authMiddleware');
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

router.put('/update-from-payment',
  authMiddleware,
  checkRole(['admin', 'service']), // Ajoutez 'service' ici
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

router.post(
  '/record-payment',
  authMiddleware, // Middleware pour vérifier l'API key inter-services
  [
    body('userId').isString().notEmpty().withMessage('ID utilisateur requis'),
    body('amount').isNumeric().withMessage('Montant requis'),
    body('currency').optional().isString(),
    body('transactionId').isString().notEmpty().withMessage('ID de transaction requis'),
    body('invoiceId').optional().isString()
  ],
  validateRequest,
  SubscriptionController.recordPayment
);

router.get(
  '/status/:userId',
  authMiddleware,
  SubscriptionController.getSubscriptionStatus
);
module.exports = router;