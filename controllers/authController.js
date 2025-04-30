const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const JwtConfig = require("../config/jwtConfig");
const logger = require("../utils/logger");
const crypto = require("crypto");
const NotificationService = require("../services/notificationService");

// Nettoyage des erreurs pour éviter d'exposer des données sensibles
function sanitizeError(err) {
  const sanitized = {
    message: err.message,
    stack: err.stack,
  };
  if (err.response?.data) sanitized.response = err.response.data;
  if (err.response?.status) sanitized.status = err.response.status;
  return sanitized;
}

class AuthController {
  // Inscription d'un nouvel utilisateur
  static async register(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: "Cet email est déjà utilisé" });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const verificationToken = crypto.randomBytes(32).toString("hex");

      const newUser = new User({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        verificationToken,
        isVerified: false,
        createdAt: new Date(),
      });

      await newUser.save();

      const accessToken = JwtConfig.generateAccessToken(newUser);
      const refreshToken = JwtConfig.generateRefreshToken(newUser);

      Promise.race([
        NotificationService.sendConfirmationEmail(
          newUser.email,
          newUser.verificationToken
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("⏳ Timeout Mailjet")), 6000)
        ),
      ]).catch((notificationError) => {
        logger.warn(
          `⚠️ Échec de l'envoi de l'email de confirmation`,
          sanitizeError(notificationError)
        );
      });

      res.status(201).json({
        message: "Utilisateur créé avec succès. Vérifiez votre boîte mail.",
        user: {
          id: newUser._id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      logger.error("Erreur complète:", sanitizeError(error));
      next(error);
    }
  }

  // Connexion d'un utilisateur existant
  static async login(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res
          .status(401)
          .json({ message: "Email ou mot de passe incorrect" });
      }

      if (!user.isVerified) {
        return res.status(403).json({
          message:
            "Veuillez confirmer votre adresse email avant de vous connecter.",
        });
      }

      const accessToken = JwtConfig.generateAccessToken(user);
      const refreshToken = JwtConfig.generateRefreshToken(user);

      res.status(200).json({
        message: "Connexion réussie",
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      logger.error("Erreur lors de la connexion", sanitizeError(error));
      next(error);
    }
  }

  // Déconnexion
  static async logout(req, res, next) {
    try {
      if (req.cookies?.refreshToken) {
        res.clearCookie("refreshToken");
      }
      res.status(200).json({ message: "Déconnexion réussie" });
    } catch (error) {
      logger.error("Erreur lors de la déconnexion", error);
      next(error);
    }
  }

  // Vérifie si un token d'accès est encore valide
  static async verifyToken(req, res, next) {
    try {
      const token =
        req.body.token || req.query.token || req.headers["x-access-token"];

      if (!token) {
        return res.status(400).json({ message: "Token requis" });
      }

      try {
        const decoded = JwtConfig.verifyAccessToken(token);
        res.status(200).json({
          valid: true,
          user: {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role,
          },
        });
      } catch (error) {
        return res.status(401).json({ valid: false, message: error.message });
      }
    } catch (error) {
      logger.error(
        "Erreur lors de la vérification du token",
        sanitizeError(error)
      );
      next(error);
    }
  }

  // Permet de renouveler un accessToken à partir d’un refreshToken
  static async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res
          .status(400)
          .json({ message: "Token de rafraîchissement requis" });
      }

      try {
        const payload = JwtConfig.verifyRefreshToken(refreshToken);
        const user = await User.findById(payload.userId);
        if (!user)
          return res.status(401).json({ message: "Utilisateur non trouvé" });

        const newAccessToken = JwtConfig.generateAccessToken(user);
        const newRefreshToken = JwtConfig.generateRefreshToken(user);

        res.status(200).json({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        });
      } catch (error) {
        return res
          .status(401)
          .json({ message: "RefreshToken invalide ou expiré" });
      }
    } catch (error) {
      logger.error(
        "Erreur lors du rafraîchissement du token",
        sanitizeError(error)
      );
      next(error);
    }
  }

  // Vérifie un compte utilisateur à l'aide du token de vérification
  static async verifyAccount(req, res, next) {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ message: "Token requis" });

      const user = await User.findOne({ verificationToken: token });
      if (!user) return res.status(400).json({ message: "Token invalide" });

      const creationDate = user.createdAt || new Date();
      const expirationDate = new Date(
        creationDate.getTime() + 24 * 60 * 60 * 1000
      );

      if (Date.now() > expirationDate.getTime()) {
        return res.status(400).json({ message: "Token expiré" });
      }

      user.isVerified = true;
      user.verificationToken = undefined;
      await user.save();

      Promise.race([
        NotificationService.sendWelcomeEmail(user.email, user.firstName || ""),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("⏳ Timeout Mailjet")), 6000)
        ),
      ]).catch((notificationError) => {
        logger.warn(
          "⚠️ Échec de l'envoi de l'email de bienvenue",
          sanitizeError(notificationError)
        );
      });

      return res.status(200).json({
        message: "Compte vérifié avec succès",
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      logger.error("Erreur lors de la vérification du compte", error);
      next(error);
    }
  }

  // Initier la réinitialisation de mot de passe par email
  static async initiatePasswordReset(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email requis" });
      }

      const user = await User.findOne({ email });

      if (user) {
        // Génération d'un code de réinitialisation à 6 chiffres valable 1h
        const resetCode = Math.floor(
          100000 + Math.random() * 900000
        ).toString();
        const resetCodeExpires = new Date(Date.now() + 60 * 60 * 1000);

        user.resetCode = resetCode;
        user.resetCodeExpires = resetCodeExpires;
        await user.save();

        // Envoi de l'email de réinitialisation (non bloquant)
        Promise.race([
          NotificationService.sendPasswordResetEmail(email, resetCode),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("⏳ Timeout Mailjet")), 6000)
          ),
        ]).catch((notificationError) => {
          logger.warn(
            `⚠️ Échec de l'envoi de l'email de réinitialisation`,
            sanitizeError(notificationError)
          );
        });
      }

      return res.status(200).json({
        message:
          "Si cet email est associé à un compte, des instructions ont été envoyées.",
      });
    } catch (error) {
      logger.error(
        "Erreur lors de la demande de réinitialisation",
        sanitizeError(error)
      );
      next(error);
    }
  }

  // Initier la réinitialisation par SMS
  static async initiatePasswordResetBySMS(req, res, next) {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ message: "Numéro de téléphone requis" });
      }

      const user = await User.findOne({ phoneNumber });

      if (user) {
        const resetCode = Math.floor(
          100000 + Math.random() * 900000
        ).toString();
        const resetCodeExpires = new Date(Date.now() + 60 * 60 * 1000);

        user.resetCode = resetCode;
        user.resetCodeExpires = resetCodeExpires;
        await user.save();

        try {
          await NotificationService.sendPasswordResetSMS(
            phoneNumber,
            resetCode
          );
        } catch (notificationError) {
          logger.warn(
            `⚠️ Échec de l'envoi du SMS`,
            sanitizeError(notificationError)
          );
        }
      }

      return res.status(200).json({
        message:
          "Si ce numéro est associé à un compte, un code a été envoyé par SMS.",
      });
    } catch (error) {
      logger.error("Erreur réinitialisation SMS", sanitizeError(error));
      next(error);
    }
  }

  // Réinitialiser le mot de passe avec un code (email requis)
  static async resetPassword(req, res, next) {
    try {
      const { email, resetCode, newPassword } = req.body;

      if (!email || !resetCode || !newPassword) {
        return res.status(400).json({
          message: "Email, code de réinitialisation et mot de passe requis",
        });
      }

      const user = await User.findOne({
        email,
        resetCode,
        resetCodeExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          message: "Code de réinitialisation invalide ou expiré",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      user.password = hashedPassword;
      user.resetCode = undefined;
      user.resetCodeExpires = undefined;
      await user.save();

      res.status(200).json({
        message: "Mot de passe réinitialisé avec succès",
      });
    } catch (error) {
      logger.error("Erreur lors de la réinitialisation", sanitizeError(error));
      next(error);
    }
  }

  // Changer le mot de passe
  static async changePassword(req, res, next) {
    try {
      const userId = req.user.userId;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          message:
            "Le mot de passe actuel et le nouveau mot de passe sont requis",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: "Utilisateur non trouvé",
        });
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isPasswordValid) {
        return res.status(401).json({
          message: "Mot de passe actuel incorrect",
        });
      }

      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({
          message:
            "Le nouveau mot de passe doit être différent du mot de passe actuel",
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      user.updatedAt = new Date();
      await user.save();

      logger.info(`Mot de passe changé pour l'utilisateur ${userId}`);

      res.status(200).json({
        message: "Mot de passe changé avec succès",
      });
    } catch (error) {
      logger.error("Erreur lors du changement de mot de passe", error);
      next(error);
    }
  }

  // Récupérer le profil
  static async getProfile(req, res, next) {
    try {
      const userId = req.user.userId;

      const user = await User.findById(userId).select(
        "-password -resetCode -resetCodeExpires -verificationToken"
      );
      if (!user) {
        return res.status(404).json({
          message: "Profil utilisateur non trouvé",
        });
      }

      // const subscription = await Subscription.findOne({
      //   userId,
      //   status: "active",
      // }).select("plan status startDate endDate");

      res.status(200).json({
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          authProvider: user.oauth?.provider || "local",
          // subscription: subscription || null,
        },
      });
    } catch (error) {
      logger.error("Erreur lors de la récupération du profil", error);
      next(error);
    }
  }

  // Modifier le profil
  static async updateProfile(req, res, next) {
    try {
      const userId = req.user.userId;
      const { firstName, lastName, phoneNumber } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ message: "Profil utilisateur non trouvé" });
      }

      const allowedUpdates = { firstName, lastName, phoneNumber };
      for (const key in allowedUpdates) {
        if (allowedUpdates[key] !== undefined) {
          user[key] = allowedUpdates[key];
        }
      }

      await user.save();

      res.status(200).json({
        message: "Profil mis à jour avec succès",
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      logger.error("Erreur lors de la mise à jour du profil", error);
      next(error);
    }
  }

  // Supprimer le compte
  static async deleteUser(req, res, next) {
    try {
      const userId = req.user.userId;

      const user = await User.findByIdAndDelete(userId);
      if (!user) {
        return res.status(404).json({
          message: "Utilisateur non trouvé",
        });
      }

      logger.info(`Compte supprimé pour l'utilisateur ${userId}`);

      res.status(200).json({
        message: "Compte supprimé avec succès",
      });
    } catch (error) {
      logger.error("Erreur lors de la suppression du compte", error);
      next(error);
    }
  }
}

module.exports = AuthController;
