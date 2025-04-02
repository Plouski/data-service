const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Un utilisateur est requis pour l\'abonnement']
  },
  plan: {
    type: String,
    enum: {
      values: ['free', 'standard', 'premium', 'enterprise'],
      message: 'Plan d\'abonnement invalide'
    },
    default: 'free'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'expired', 'canceled', 'pending'],
      message: 'Statut d\'abonnement invalide'
    },
    default: 'active'
  },
  renewalDate: {
    type: Date
  },
  paymentInfo: {
    transactionId: String,
    method: String,
    lastFourDigits: String
  },
  features: {
    maxTrips: {
      type: Number,
      default: function() {
        switch(this.plan) {
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
        switch(this.plan) {
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
    }
  }
}, {
  timestamps: true,
  indexes: [
    { userId: 1 },
    { plan: 1 },
    { status: 1 }
  ]
});

// Hook avant la sauvegarde pour gérer les dates
SubscriptionSchema.pre('save', function(next) {
  // Définir automatiquement la date de fin selon le plan
  if (!this.endDate) {
    const endDate = new Date();
    switch(this.plan) {
      case 'free':
        endDate.setMonth(endDate.getMonth() + 1); // 1 mois gratuit
        break;
      case 'standard':
        endDate.setMonth(endDate.getMonth() + 12); // 1 an
        break;
      case 'premium':
        endDate.setMonth(endDate.getMonth() + 12); // 1 an
        break;
      case 'enterprise':
        endDate.setFullYear(endDate.getFullYear() + 1); // 1 an
        break;
    }
    this.endDate = endDate;
  }

  // Mettre à jour le statut selon les dates
  if (this.endDate && this.endDate < new Date()) {
    this.status = 'expired';
  }

  next();
});

// Méthode statique pour trouver l'abonnement actif d'un utilisateur
SubscriptionSchema.statics.findActiveSubscription = function(userId) {
  return this.findOne({
    userId: userId,
    status: 'active',
    endDate: { $gt: new Date() }
  });
};

const Subscription = mongoose.model('Subscription', SubscriptionSchema);

module.exports = Subscription;