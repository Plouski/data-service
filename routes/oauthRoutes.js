const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauthController');

// Route pour gérer l'appel depuis le auth-service
router.post('/oauth/google', oauthController.handleGoogleOAuth);
router.post('/oauth/facebook', oauthController.handleFacebookOAuth);
router.post('/oauth/github', oauthController.handleGithubOAuth);

module.exports = router;