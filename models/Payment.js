// database-service/models/Payment.js
const mongoose = require('mongoose');

/**
 * Schéma pour les paiements
 * Enregistre l'historique des transactions de paiement
 */
const PaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Un ID utilisateur est requis']
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  amount: {
    type: Number,
    required: [true, 'Le montant est requis'],
    min: [0, 'Le montant doit être positif']
  },
  currency: {
    type: String,
    required: [true, 'La devise est requise'],
    enum: {
      values: ['EUR', 'USD', 'GBP', 'CAD'],
      message: 'Devise non supportée'
    },
    default: 'EUR'
  },
  status: {
    type: String,
    required: [true, 'Le statut est requis'],
    enum: {
      values: ['pending', 'succeeded', 'failed', 'refunded'],
      message: 'Statut de paiement invalide'
    },
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    required: [true, 'La méthode de paiement est requise'],
    enum: {
      values: ['card', 'paypal', 'transfer', 'other'],
      message: 'Méthode de paiement non supportée'
    },
    default: 'card'
  },
  paymentProcessor: {
    type: String,
    required: [true, 'Le processeur de paiement est requis'],
    enum: {
      values: ['stripe', 'paypal', 'manual', 'other'],
      message: 'Processeur de paiement non supporté'
    },
    default: 'stripe'
  },
  paymentDetails: {
    // Identifiants externes
    transactionId: String,
    invoiceId: String,
    sessionId: String,
    
    // Détails de carte (masqués pour la sécurité)
    last4: String,
    cardBrand: String,
    expiryMonth: Number,
    expiryYear: Number,
    
    // Adresse de facturation
    billingDetails: {
      name: String,
      email: String,
      phone: String,
      address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String
      }
    },
    
    // Métadonnées supplémentaires
    metadata: {
      type: Map,
      of: String
    }
  },
  description: {
    type: String,
    default: ''
  },
  refundReason: {
    type: String,
    default: null
  },
  refundedAt: {
    type: Date,
    default: null
  },
  paymentDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes pour les recherches courantes
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ subscriptionId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ 'paymentDetails.transactionId': 1 });
PaymentSchema.index({ createdAt: -1 });

// Méthode pour calculer le montant total des paiements d'un utilisateur
PaymentSchema.statics.getTotalAmountByUser = async function(userId) {
  const result = await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId), status: 'succeeded' } },
    { $group: { _id: '$currency', total: { $sum: '$amount' } } }
  ]);
  
  return result;
};

// Méthode pour récupérer l'historique des paiements d'un utilisateur
PaymentSchema.statics.getPaymentHistory = async function(userId, options = {}) {
  const {
    limit = 10,
    page = 1,
    status = null,
    startDate = null,
    endDate = null,
    sort = { createdAt: -1 }
  } = options;

  const query = { userId: mongoose.Types.ObjectId(userId) };
  
  if (status) {
    query.status = status;
  }
  
  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const payments = await this.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .select('-__v');
  
  const total = await this.countDocuments(query);
  
  return {
    payments,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
};

// Méthode pour traiter un remboursement
PaymentSchema.methods.processRefund = async function(reason) {
  if (this.status !== 'succeeded') {
    throw new Error('Seuls les paiements réussis peuvent être remboursés');
  }
  
  this.status = 'refunded';
  this.refundReason = reason;
  this.refundedAt = new Date();
  
  return this.save();
};

const Payment = mongoose.model('Payment', PaymentSchema);

module.exports = Payment;