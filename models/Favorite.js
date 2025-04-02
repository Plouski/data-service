const mongoose = require('mongoose');

const FavoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Un utilisateur est requis']
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: [true, 'Un trip est requis']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères']
  },
  customTags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Un tag ne peut pas dépasser 30 caractères']
  }],
  plannedDate: {
    type: Date,
    default: null
  },
  priority: {
    type: String,
    enum: {
      values: ['basse', 'moyenne', 'haute'],
      message: 'Priorité invalide'
    },
    default: 'basse'
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  indexes: [
    { userId: 1 },
    { tripId: 1 },
    { priority: 1 },
    { isArchived: 1 }
  ]
});

// Empêcher les doublons de favoris
FavoriteSchema.index({ userId: 1, tripId: 1 }, { unique: true });

// Méthode statique pour récupérer les favoris d'un utilisateur
FavoriteSchema.statics.getUserFavorites = function(userId) {
  return this.find({ userId })
    .populate({
      path: 'tripId',
      select: 'title description season budget difficulty'
    })
    .sort({ createdAt: -1 });
};

// Hook avant la sauvegarde pour valider
FavoriteSchema.pre('save', function(next) {
  // Limite du nombre de tags personnalisés
  if (this.customTags && this.customTags.length > 5) {
    next(new Error('Maximum 5 tags personnalisés'));
  }
  next();
});

const Favorite = mongoose.model('Favorite', FavoriteSchema);

module.exports = Favorite;