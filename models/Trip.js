const mongoose = require('mongoose');
const slugify = require('slugify');

const TripSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Un titre est requis pour le trip'],
    trim: true,
    maxlength: [100, 'Le titre ne peut pas dépasser 100 caractères']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'La description ne peut pas dépasser 1000 caractères']
  },
  slug: {
    type: String,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Un utilisateur est requis']
  },
  steps: [{
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: [true, 'Des coordonnées sont requises']
      },
      address: {
        type: String,
        required: [true, 'Une adresse est requise']
      }
    },
    description: {
      type: String,
      trim: true
    },
    expectedDuration: {
      type: Number, // en heures
      min: [0, 'La durée ne peut pas être négative']
    },
    order: {
      type: Number,
      min: [0, 'L\'ordre doit être positif']
    }
  }],
  season: {
    type: String,
    enum: {
      values: ['printemps', 'été', 'automne', 'hiver'],
      message: 'Saison invalide'
    }
  },
  budget: {
    currency: {
      type: String,
      default: 'EUR',
      enum: ['EUR', 'USD', 'CAD', 'GBP']
    },
    amount: {
      type: Number,
      min: [0, 'Le budget ne peut pas être négatif']
    }
  },
  difficulty: {
    type: String,
    enum: {
      values: ['facile', 'moyen', 'difficile', 'expert'],
      message: 'Niveau de difficulté invalide'
    },
    default: 'facile'
  },
  estimatedTotalDistance: {
    type: Number, // en kilomètres
    min: [0, 'La distance ne peut pas être négative']
  },
  tags: [{
    type: String,
    trim: true
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  estimatedDuration: {
    type: Number, // en jours
    min: [1, 'La durée doit être d\'au moins un jour']
  }
}, {
  timestamps: true,
  indexes: [
    { userId: 1 },
    { season: 1 },
    { 'budget.amount': 1 },
    { tags: 1 }
  ]
});

// Créer un slug unique à partir du titre
TripSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
      trim: true
    }) + '-' + Date.now();
  }
  next();
});

// Méthode statique pour rechercher des trips
TripSchema.statics.searchTrips = function(query) {
  return this.find({
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { tags: { $regex: query, $options: 'i' } }
    ],
    isPublic: true
  });
};

// Méthode virtuelle pour calculer la durée totale
TripSchema.virtual('totalDuration').get(function() {
  return this.steps.reduce((total, step) => 
    total + (step.expectedDuration || 0), 0
  );
});

// Personnaliser la transformation du document
TripSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

const Trip = mongoose.model('Trip', TripSchema);

module.exports = Trip;