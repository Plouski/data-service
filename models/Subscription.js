// database-service/models/Subscription.js
const mongoose = require('mongoose');

/**
 * Schéma pour les abonnements
 * Gère les abonnements utilisateur et leurs fonctionnalités
 */
const SubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Un utilisateur est requis pour l\'abonnement'],
    index: true
  },
  plan: {
    type: String,
    enum: {
      values: ['free', 'standard', 'premium', 'enterprise'],
      message: 'Plan d\'abonnement invalide'
    },
    default: 'free',
    index: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: function() {
      // Calcul automatique de la date de fin selon le plan
      const date = new Date();
      switch (this.plan) {
        case 'free':
          date.setMonth(date.getMonth() + 1); // 1 mois
          break;
        case 'standard':
        case 'premium':
        case 'enterprise':
          date.setFullYear(date.getFullYear() + 1); // 1 an
          break;
        default:
          date.setMonth(date.getMonth() + 1);
      }
      return date;
    }
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'active', 'trialing', 'past_due', 'canceled', 'expired', 'suspended'],
      message: 'Statut d\'abonnement invalide'
    },
    default: 'active',
    index: true
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  trialEndsAt: {
    type: Date,
    default: null
  },
  renewalDate: {
    type: Date,
    default: function() {
      return this.endDate;
    }
  },
  canceledAt: {
    type: Date,
    default: null
  },
  cancelReason: {
    type: String,
    default: null
  },
  paymentInfo: {
    method: {
      type: String,
      enum: {
        values: ['card', 'paypal', 'transfer', 'free', 'stripe'],
        message: 'Méthode de paiement invalide'
      },
      default: 'free'
    },
    lastFourDigits: String,
    cardBrand: String,
    expiryMonth: Number,
    expiryYear: Number,
    stripeCustomerId: {
      type: String,
      index: true
    },
    stripeSubscriptionId: {
      type: String,
      index: true
    },
    stripePriceId: String,
    paypalSubscriptionId: String
  },
  paymentHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    amount: Number,
    currency: {
      type: String,
      default: 'EUR'
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'refunded', 'pending'],
      default: 'success'
    },
    transactionId: String,
    invoiceId: String
  }],
  metadata: {
    type: Map,
    of: String,
    default: {}
  },
  features: {
    maxTrips: {
      type: Number,
      default: function() {
        switch (this.plan) {
          case 'free': return 3;
          case 'standard': return 10;
          case 'premium': return 50;
          case 'enterprise': return 1000;
          default: return 3;
        }
      }
    },
    aiConsultations: {
      type: Number,
      default: function() {
        switch (this.plan) {
          case 'free': return 1;
          case 'standard': return 5;
          case 'premium': return 20;
          case 'enterprise': return 100;
          default: return 1;
        }
      }
    },
    customization: {
      type: Boolean,
      default: function() {
        return ['premium', 'enterprise'].includes(this.plan);
      }
    },
    maxCollaborators: {
      type: Number,
      default: function() {
        switch (this.plan) {
          case 'free': return 0;
          case 'standard': return 1;
          case 'premium': return 5;
          case 'enterprise': return 20;
          default: return 0;
        }
      }
    },
    exportFormats: {
      type: [String],
      default: function() {
        switch (this.plan) {
          case 'free': return ['pdf'];
          case 'standard': return ['pdf', 'csv'];
          case 'premium': 
          case 'enterprise': return ['pdf', 'csv', 'excel', 'gpx'];
          default: return ['pdf'];
        }
      }
    },
    prioritySupport: {
      type: Boolean,
      default: function() {
        return ['premium', 'enterprise'].includes(this.plan);
      }
    },
    offlineAccess: {
      type: Boolean,
      default: function() {
        return ['premium', 'enterprise'].includes(this.plan);
      }
    },
    advertisingFree: {
      type: Boolean,
      default: function() {
        return this.plan !== 'free';
      }
    }
  },
  usageStats: {
    tripsCreated: {
      type: Number,
      default: 0
    },
    aiConsultationsUsed: {
      type: Number,
      default: 0
    },
    lastUsedAt: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true
});

// Hooks pour maintenir les dates cohérentes
SubscriptionSchema.pre('save', function(next) {
  // Mise à jour du statut selon les dates
  const now = new Date();
  
  if (this.status !== 'canceled' && this.status !== 'suspended') {
    if (this.trialEndsAt && this.trialEndsAt > now) {
      this.status = 'trialing';
    } else if (this.endDate < now) {
      this.status = 'expired';
    } else {
      this.status = 'active';
    }
  }
  
  // Si le statut devient 'canceled', enregistrer la date d'annulation
  if (this.status === 'canceled' && !this.canceledAt) {
    this.canceledAt = now;
  }
  
  next();
});

// Méthode pour ajouter un paiement à l'historique
SubscriptionSchema.methods.addPaymentToHistory = async function(paymentData) {
  this.paymentHistory.push({
    date: paymentData.date || new Date(),
    amount: paymentData.amount,
    currency: paymentData.currency || 'EUR',
    status: paymentData.status || 'success',
    transactionId: paymentData.transactionId,
    invoiceId: paymentData.invoiceId
  });

  return this.save();
};

// Méthode pour annuler un abonnement
SubscriptionSchema.methods.cancel = async function(reason) {
  this.status = 'canceled';
  this.canceledAt = new Date();
  this.cancelReason = reason || null;
  this.autoRenew = false;
  
  return this.save();
};

// Méthode pour vérifier si un abonnement est actif
SubscriptionSchema.methods.isActive = function() {
  return (
    (this.status === 'active' || this.status === 'trialing') &&
    this.endDate > new Date()
  );
};

// Méthode pour renouveler un abonnement
SubscriptionSchema.methods.renew = async function() {
  // Calculer la nouvelle date de fin
  const newEndDate = new Date(this.endDate);
  switch (this.plan) {
    case 'free':
      newEndDate.setMonth(newEndDate.getMonth() + 1);
      break;
    case 'standard':
    case 'premium':
    case 'enterprise':
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
      break;
  }
  
  this.endDate = newEndDate;
  this.renewalDate = newEndDate;
  this.status = 'active';
  
  return this.save();
};

// Méthode pour mettre à jour les statistiques d'utilisation
SubscriptionSchema.methods.updateUsageStats = async function(stats) {
  if (stats.tripsCreated) {
    this.usageStats.tripsCreated += stats.tripsCreated;
  }
  
  if (stats.aiConsultationsUsed) {
    this.usageStats.aiConsultationsUsed += stats.aiConsultationsUsed;
  }
  
  this.usageStats.lastUsedAt = new Date();
  
  return this.save();
};

// Méthode pour vérifier si l'utilisation est dans les limites
SubscriptionSchema.methods.checkUsageLimits = function() {
  const limits = {
    tripsLimit: this.features.maxTrips > this.usageStats.tripsCreated,
    aiConsultationsLimit: this.features.aiConsultations > this.usageStats.aiConsultationsUsed,
    isWithinLimits: this.features.maxTrips > this.usageStats.tripsCreated &&
                    this.features.aiConsultations > this.usageStats.aiConsultationsUsed
  };
  
  return limits;
};

// Méthode statique pour trouver l'abonnement actif d'un utilisateur
SubscriptionSchema.statics.findActiveSubscription = async function(userId) {
  return this.findOne({
    userId: userId,
    status: { $in: ['active', 'trialing'] },
    endDate: { $gt: new Date() }
  });
};

// Méthode statique pour chercher un utilisateur par Stripe Customer ID
SubscriptionSchema.statics.findByStripeCustomerId = async function(stripeCustomerId) {
  return this.findOne({
    'paymentInfo.stripeCustomerId': stripeCustomerId
  }).populate('userId');
};

// Créer le modèle
const Subscription = mongoose.model('Subscription', SubscriptionSchema);

module.exports = Subscription;