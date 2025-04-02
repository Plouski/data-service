const mongoose = require('mongoose');

const AiHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Un utilisateur est requis']
  },
  input: {
    type: String,
    required: [true, 'L\'entrée IA est requise'],
    trim: true,
    maxlength: [2000, 'L\'entrée ne peut pas dépasser 2000 caractères']
  },
  response: {
    type: String,
    required: [true, 'La réponse IA est requise'],
    trim: true,
    maxlength: [5000, 'La réponse ne peut pas dépasser 5000 caractères']
  },
  category: {
    type: String,
    enum: {
      values: [
        'trip_planning', 
        'destination_suggestion', 
        'itinerary_optimization', 
        'budget_advice', 
        'travel_tips', 
        'other'
      ],
      message: 'Catégorie IA invalide'
    },
    default: 'other'
  },
  context: {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null
    },
    additionalContext: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  feedback: {
    rating: {
      type: Number,
      min: [1, 'La note minimale est 1'],
      max: [5, 'La note maximale est 5']
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Le commentaire ne peut pas dépasser 500 caractères']
    }
  },
  tokens: {
    input: {
      type: Number,
      default: 0
    },
    output: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  indexes: [
    { userId: 1 },
    { category: 1 },
    { createdAt: -1 }
  ]
});

// Méthode statique pour récupérer l'historique IA d'un utilisateur
AiHistorySchema.statics.getUserHistory = function(userId, options = {}) {
  const { 
    limit = 50, 
    category = null, 
    startDate = null, 
    endDate = null 
  } = options;

  let query = { userId };

  if (category) {
    query.category = category;
  }

  if (startDate && endDate) {
    query.createdAt = {
      $gte: startDate,
      $lte: endDate
    };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-__v');
};

// Hook avant la sauvegarde pour calculer les tokens
AiHistorySchema.pre('save', function(next) {
  // Estimation simple du nombre de tokens 
  // (1 token ≈ 4 caractères)
  this.tokens = {
    input: Math.ceil(this.input.length / 4),
    output: Math.ceil(this.response.length / 4)
  };

  next();
});

const AiHistory = mongoose.model('AiHistory', AiHistorySchema);

module.exports = AiHistory;