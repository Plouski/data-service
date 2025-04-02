const sanitizeHtml = require('sanitize-html');
const validator = require('validator');

class Sanitizer {
  // Nettoyer et valider un email
  // static sanitizeEmail(email) {
  //   if (!email) return null;
  
  //   // Normaliser l'email
  //   const sanitizedEmail = validator.normalizeEmail(email, {
  //     gmail_remove_dots: false,
  //     gmail_remove_subaddress: false,
  //     outlookdotcom_remove_subaddress: false, // <-- Ajouté
  //     icloud_remove_subaddress: false // <-- Ajouté
  //   });
  
  //   // Valider le format
  //   if (!validator.isEmail(sanitizedEmail)) {
  //     throw new Error('Format d\'email invalide');
  //   }
  
  //   return sanitizedEmail;
  // }

  // Nettoyer du HTML pour prévenir les XSS
  static sanitizeHtml(htmlContent, options = {}) {
    const defaultOptions = {
      allowedTags: [ 'b', 'i', 'em', 'strong', 'a' ],
      allowedAttributes: {
        'a': [ 'href' ]
      },
      allowedSchemesByTag: {
        'a': [ 'http', 'https', 'mailto' ]
      }
    };

    return sanitizeHtml(htmlContent, { ...defaultOptions, ...options });
  }

  // Nettoyer et valider un mot de passe
  static validatePassword(password) {
    if (!password) {
      throw new Error('Mot de passe requis');
    }

    // Critères de mot de passe fort
    if (password.length < 8) {
      throw new Error('Le mot de passe doit contenir au moins 8 caractères');
    }

    if (!/\d/.test(password)) {
      throw new Error('Le mot de passe doit contenir au moins un chiffre');
    }

    if (!/[A-Z]/.test(password)) {
      throw new Error('Le mot de passe doit contenir au moins une majuscule');
    }

    // Prévenir les mots de passe trop communs
    const commonPasswords = [
      'password', '123456', 'qwerty', 'admin'
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
      throw new Error('Mot de passe trop courant');
    }

    return password;
  }

  // Nettoyer les entrées génériques
  static cleanInput(input, maxLength = 500) {
    if (!input) return null;

    // Convertir en chaîne
    let cleanedInput = String(input);

    // Limiter la longueur
    cleanedInput = cleanedInput.substring(0, maxLength);

    // Échapper les caractères spéciaux
    cleanedInput = validator.escape(cleanedInput);

    return cleanedInput.trim();
  }

  // Valider et nettoyer un numéro de téléphone
  static sanitizePhone(phone) {
    if (!phone) return null;

    // Supprimer tous les caractères non numériques
    const cleanPhone = phone.replace(/\D/g, '');

    // Valider le format (peut être ajusté selon le pays)
    if (!validator.isMobilePhone(cleanPhone, 'any')) {
      throw new Error('Numéro de téléphone invalide');
    }

    return cleanPhone;
  }

  // Valider une URL
  static sanitizeUrl(url) {
    if (!url) return null;

    // Nettoyer et valider l'URL
    const sanitizedUrl = validator.normalizeUrl(url, {
      forceHttps: true,
      removeTrailingSlash: true
    });

    if (!validator.isURL(sanitizedUrl)) {
      throw new Error('URL invalide');
    }

    return sanitizedUrl;
  }
}

module.exports = Sanitizer;