const axios = require("axios");
const logger = require("../utils/logger");
const User = require("../models/User");
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:5005";
const FREE_MOBILE_USERNAME = process.env.FREE_MOBILE_USERNAME;
const FREE_MOBILE_API_KEY = process.env.FREE_MOBILE_API_KEY;

// Cache temporaire pour éviter les envois d'emails en double
const emailCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Système de suivi des livraisons (emails/SMS envoyés)
const deliveryTracking = new Map();

// Création d'une instance Axios personnalisée
const createAxiosInstance = () => {
  return axios.create({
    timeout: 45000,
    headers: {
      "Content-Type": "application/json",
      Connection: "keep-alive",
    },
    validateStatus: function (status) {
      return status < 500;
    },
  });
};

const NotificationService = {

  // Vérifie si un email du même type a été récemment envoyé
  isRecentlySent: (email, type, token = null) => {
    const cacheKey = `${email}-${type}-${token}`;
    const lastSent = emailCache.get(cacheKey);

    if (lastSent && Date.now() - lastSent < CACHE_DURATION) {
      logger.warn("🚫 Email déjà envoyé récemment - ignoré", {
        service: "notification-service",
        action: "duplicate_prevented",
        email,
        type,
        lastSentAgo: `${Math.round((Date.now() - lastSent) / 1000)}s`,
      });
      return true;
    }

    return false;
  },

  // Marque un email comme envoyé (enregistré dans le cache)
  markAsSent: (email, type, token = null) => {
    const cacheKey = `${email}-${type}-${token}`;
    emailCache.set(cacheKey, Date.now());

    // Nettoyage du cache si trop d'éléments
    if (emailCache.size > 100) {
      const cutoff = Date.now() - CACHE_DURATION;
      for (const [key, timestamp] of emailCache.entries()) {
        if (timestamp < cutoff) {
          emailCache.delete(key);
        }
      }
    }
  },

  // Enregistre une tentative d'envoi (email ou SMS)
  recordDelivery: (id, type, recipient, status = "sent") => {
    const record = {
      id,
      type,
      recipient,
      status,
      sentAt: new Date(),
      attempts: 1,
      lastAttempt: new Date(),
    };

    deliveryTracking.set(id, record);

    logger.info("📊 Envoi enregistré dans le suivi", {
      service: "notification-service",
      action: "delivery_recorded",
      id,
      type,
      recipient,
      status,
    });

    return record;
  },

  // Met à jour le statut de livraison (succès, échec, annulé)
  updateDeliveryStatus: (id, status, error = null) => {
    const record = deliveryTracking.get(id);
    if (record) {
      record.status = status;
      record.lastUpdate = new Date();
      if (error) record.error = error;

      logger.info("📊 Statut de livraison mis à jour", {
        service: "notification-service",
        action: "delivery_status_updated",
        id,
        status,
        error: error?.message,
      });
    }
  },

  // Envoie un email de confirmation d'inscription
  sendConfirmationEmail: async (email, token, retryCount = 0, deliveryId = null) => {
    if (!deliveryId) {
      deliveryId = `confirm_${email}_${Date.now()}`;
    }

    if (NotificationService.isRecentlySent(email, "confirm", token)) {
      return { status: 200, data: { message: "Email déjà envoyé récemment" } };
    }

    try {
      const user = await User.findOne({ email });
      if (!user) {
        logger.warn("🚫 Utilisateur inexistant");
        return { status: 400, data: { message: "Utilisateur inexistant" } };
      }

      if (user.isVerified) {
        logger.info("🚫 Utilisateur déjà vérifié");
        return { status: 200, data: { message: "Utilisateur déjà vérifié" } };
      }

      if (user.verificationToken !== token) {
        logger.warn("🚫 Token de vérification invalide");
        return { status: 400, data: { message: "Token invalide" } };
      }
    } catch (dbError) {
      logger.error("❌ Erreur lors de la vérification utilisateur");
    }

    const maxRetries = 3;
    const retryDelay = 3000;
    const axiosInstance = createAxiosInstance();

    try {
      if (retryCount === 0) {
        NotificationService.recordDelivery(deliveryId, "email", email, "pending");
      }

      logger.info("📧 Tentative d'envoi d'email de confirmation");

      const res = await axiosInstance.post(
        `${NOTIFICATION_SERVICE_URL}/api/notifications/email`,
        {
          type: "confirm",
          email,
          tokenOrCode: token,
          deliveryId,
        }
      );

      if (res.status >= 400) {
        throw new Error(`Erreur HTTP ${res.status}: ${res.statusText}`);
      }

      NotificationService.markAsSent(email, "confirm", token);
      NotificationService.updateDeliveryStatus(deliveryId, "sent");

      logger.info("✅ Email de confirmation envoyé avec succès");
      return { ...res, deliveryId };
    } catch (err) {
      NotificationService.updateDeliveryStatus(deliveryId, "failed", err);

      logger.error("❌ Échec lors de l'envoi de l'email de confirmation");

      if (retryCount > 0) {
        try {
          const user = await User.findOne({ email });
          if (user && user.isVerified) {
            logger.info("✅ Utilisateur vérifié pendant retry");
            NotificationService.updateDeliveryStatus(deliveryId, "cancelled");
            return { status: 200, data: { message: "Utilisateur déjà vérifié" } };
          }
        } catch (dbError) {}
      }

      const shouldRetry =
        retryCount < maxRetries &&
        (["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ECONNABORTED", "ENOTFOUND"].includes(err.code) ||
         err.message.includes("socket hang up") ||
         err.message.includes("timeout") ||
         err.response?.status >= 500);

      if (shouldRetry) {
        const nextDelay = retryDelay * Math.pow(1.5, retryCount);
        logger.warn("🔄 Nouvelle tentative d'envoi d'email");
        await new Promise((resolve) => setTimeout(resolve, nextDelay));
        return NotificationService.sendConfirmationEmail(email, token, retryCount + 1, deliveryId);
      }

      logger.error("❌ Toutes les tentatives ont échoué");
      throw err;
    }
  },

  // Envoie un email de réinitialisation de mot de passe
  sendPasswordResetEmail: async (email, code, retryCount = 0) => {
    const deliveryId = `reset_${email}_${Date.now()}`;

    if (NotificationService.isRecentlySent(email, "reset", code)) {
      return { status: 200, data: { message: "Email déjà envoyé récemment" } };
    }

    const maxRetries = 3;
    const retryDelay = 3000;
    const axiosInstance = createAxiosInstance();

    try {
      NotificationService.recordDelivery(deliveryId, "email", email, "pending");

      logger.info("🔑 Tentative d'envoi d'email de réinitialisation");

      const res = await axiosInstance.post(
        `${NOTIFICATION_SERVICE_URL}/api/notifications/email`,
        {
          type: "reset",
          email,
          tokenOrCode: code,
          deliveryId,
        }
      );

      if (res.status >= 400) {
        throw new Error(`Erreur HTTP ${res.status}: ${res.statusText}`);
      }

      NotificationService.markAsSent(email, "reset", code);
      NotificationService.updateDeliveryStatus(deliveryId, "sent");

      logger.info("✅ Email de réinitialisation envoyé");
      return { ...res, deliveryId };
    } catch (err) {
      NotificationService.updateDeliveryStatus(deliveryId, "failed", err);

      logger.error("❌ Erreur lors de l'envoi de l'email de réinitialisation");

      const shouldRetry = retryCount < maxRetries && (
        ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ECONNABORTED", "ENOTFOUND"].includes(err.code) ||
        err.message.includes("socket hang up") ||
        err.message.includes("timeout") ||
        err.response?.status >= 500
      );

      if (shouldRetry) {
        const nextDelay = retryDelay * Math.pow(1.5, retryCount);
        logger.warn("🔄 Nouvelle tentative d'envoi d'email");
        await new Promise((resolve) => setTimeout(resolve, nextDelay));
        return NotificationService.sendPasswordResetEmail(email, code, retryCount + 1);
      }

      logger.error("❌ Toutes les tentatives ont échoué");
      throw err;
    }
  },

  // Envoie un SMS de réinitialisation de mot de passe via Free Mobile
  sendPasswordResetSMS: async (phoneNumber, code) => {
    const deliveryId = `sms_${phoneNumber}_${Date.now()}`;
    const axiosInstance = createAxiosInstance();

    try {
      NotificationService.recordDelivery(deliveryId, "sms", phoneNumber, "pending");

      logger.info("📱 Préparation de l'envoi SMS");

      // Vérifie la configuration Free Mobile
      if (!FREE_MOBILE_USERNAME || !FREE_MOBILE_API_KEY) {
        logger.error("❌ Configuration Free Mobile manquante");
        NotificationService.updateDeliveryStatus(
          deliveryId,
          "failed",
          new Error("Configuration manquante")
        );
        throw new Error("Configuration Free Mobile manquante");
      }

      // Envoi du SMS
      const response = await axiosInstance.post(
        `${NOTIFICATION_SERVICE_URL}/api/notifications/sms`,
        {
          username: FREE_MOBILE_USERNAME,
          apiKey: FREE_MOBILE_API_KEY,
          code: code,
          type: "reset",
          deliveryId,
        }
      );

      NotificationService.updateDeliveryStatus(deliveryId, "sent");

      logger.info("✅ SMS envoyé avec succès");
      return { ...response.data, deliveryId };
    } catch (error) {
      NotificationService.updateDeliveryStatus(deliveryId, "failed", error);
      logger.error("❌ Échec de l'envoi du SMS");
      throw error;
    }
  },

  // Annule tous les envois d'emails en attente pour un utilisateur
  cancelPendingEmails: (email) => {
    NotificationService.markAsSent(email, "confirm");
    NotificationService.markAsSent(email, "reset");

    logger.info("🚫 Emails en attente annulés", {
      email,
    });
  }
};

module.exports = NotificationService;