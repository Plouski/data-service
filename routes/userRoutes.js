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

router.post('/register',
  registerValidation,
  validateRequest,
  UserController.createUser
);

router.post('/login', 
  validateRequest,
  UserController.loginUser
);

router.get('/email/:email', 
  authMiddleware,
  UserController.getUserByEmail
);

router.post('/verify-account',
  registerValidation,
  validateRequest,
);

router.post('/reset-password', 
  UserController.resetPassword
);

router.get('/profile', 
  authMiddleware,
  UserController.getUserProfile
);

router.put('/profile', 
  authMiddleware,
  validateRequest,
  UserController.updateUserProfile
);

router.put('/change-password', 
  authMiddleware,
  validateRequest,
  (req, res, next) => UserController.changeUserPassword(req, res, next)
);

router.delete('/account', 
  authMiddleware,
  UserController.deleteUserAccount
);

router.post('/password-reset', UserController.storeResetToken);

module.exports = router;