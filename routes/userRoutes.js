const express = require('express');
const { body } = require('express-validator');
const passport = require('passport');
const UserController = require('../controllers/userController');
const OAuthController = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();

// Validation pour l'inscription
const registerValidation = [
  body('email')
  .trim()
  .notEmpty().withMessage('L\'email est requis')
  .isEmail().withMessage('Format d\'email invalide')
  .normalizeEmail({
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,      
    gmail_convert_googlemaildot: false,
    all_lowercase: true,
    gmail_lowercase: true
  })
  .custom((value) => {
    console.log('Email après normalizeEmail:', value); // <-- Log ajouté ici
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(value)) {
      throw new Error('Adresse email invalide');
    }
    return true;
  }),
  body('password')
    .isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/\d/).withMessage('Le mot de passe doit contenir un chiffre')
    .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir une majuscule')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Le mot de passe doit contenir un caractère spécial'),

  body('firstName')
    .optional()
    .trim()
    .isString().withMessage('Prénom invalide')
    .isLength({ max: 50 }).withMessage('Prénom trop long'),

  body('lastName')
    .optional()
    .trim()
    .isString().withMessage('Nom invalide')
    .isLength({ max: 50 }).withMessage('Nom trop long')
];

// Routes publiques
router.post(
  '/register', 
  registerValidation,
  validateRequest,
  UserController.createUser
);

router.post(
  '/login', 
  validateRequest,
  UserController.loginUser
);

// Routes protégées
router.get(
  '/profile', 
  authMiddleware,
  UserController.getUserProfile
);

router.put(
  '/profile', 
  authMiddleware,
  [
    body('firstName')
      .optional()
      .isString().withMessage('Prénom invalide')
      .isLength({ max: 50 }).withMessage('Prénom trop long'),
    body('lastName')
      .optional()
      .isString().withMessage('Nom invalide')
      .isLength({ max: 50 }).withMessage('Nom trop long')
  ],
  validateRequest,
  UserController.updateUserProfile
);

router.delete(
  '/account', 
  authMiddleware,
  UserController.deleteUserAccount
);

// In userRoutes.js of data-service
router.post('/forgot-password', 
  [
    body('email').isEmail().withMessage('Email invalide'),
    validateRequest
  ],
  UserController.forgotPassword
);

router.post('/oauth/google', UserController.handleGoogleOAuth);
router.post('/oauth/facebook', UserController.handleFacebookOAuth);
router.post('/oauth/github', UserController.handleGithubOAuth);

router.get('/:id', authMiddleware, UserController.getUserById);
router.get('/email/:email', UserController.getUserByEmail);
router.patch('/:userId/verification', UserController.updateVerificationStatus);
router.post('/:userId/reset-password', UserController.createPasswordResetToken);


module.exports = router;