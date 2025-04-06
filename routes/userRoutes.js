const express = require('express');
const { body } = require('express-validator');
const UserController = require('../controllers/userController');
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
//Inscription
router.post('/register', registerValidation,validateRequest,UserController.createUser);

//Google
router.post('/oauth/google', UserController.handleGoogleOAuth);

//Facebook
router.post('/oauth/facebook', UserController.handleFacebookOAuth);

//Github
router.post('/oauth/github', UserController.handleGithubOAuth);

//Connexion avec email
router.post('/login', validateRequest,UserController.loginUser);

//Reinitialiser le mdp oublié avec le code donné par notification-service
router.post('/:userId/reset-password', UserController.createPasswordResetToken);
router.post('/reset-password', UserController.resetPassword);

//Verifier le compte avec le token donné par notification-service
router.get('/email/:email', UserController.getUserByEmail);
router.post('/:userId/verify', UserController.createVerificationToken);
router.post('/verify-account', UserController.verifyAccount);

// Routes protégées
// Recuperer tous les infos d'un utilisateur par son id
router.get('/:id', authMiddleware, UserController.getUserById);

// Recuperer le rofile
router.get('/profile', authMiddleware,UserController.getUserProfile);

// Modifier les infos du profile
router.put('/profile', authMiddleware,
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

// Supprimer le compte
router.delete('/account', authMiddleware,UserController.deleteUserAccount);

module.exports = router;