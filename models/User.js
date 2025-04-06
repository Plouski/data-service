const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    // Informations personnelles
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: {
      type: String,
      required: [true, 'Veuillez fournir une adresse email'],
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Adresse email invalide'
      ]
    },
    profilePicture: {
      type: String,
      default: null
    },
    role: {
      type: String,
      enum: ['user', 'premium', 'admin'],
      default: 'user'
    },

    // Authentification
    password: {
      type: String,
      minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
      select: false,
      required: function () {
        return !this.oauth?.googleId && !this.oauth?.facebookId && !this.oauth?.appleId && !this.oauth?.githubId;
      }
    },
    lastLogin: {
      type: Date,
      default: null
    },

    // Gestion des abonnements
    activeSubscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null
    },

    // Authentification externe (OAuth)
    oauth: {
      googleId: { type: String, unique: true, sparse: true },
      facebookId: { type: String, unique: true, sparse: true },
      appleId: { type: String, unique: true, sparse: true }
    },

    // Réinitialisation du mot de passe
    resetPasswordCode: {
      type: String,
      default: null,
      trim: true
    },
    resetPasswordToken: {
      type: String,
      default: null,
      trim: true
    },
    resetPasswordExpires: {
      type: Date,
      default: null
    },

    // Vérification d’email
    verificationToken: {
      type: String,
      default: null
    },
    verificationTokenExpires: {
      type: Date,
      default: null
    },
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ createdAt: -1 });

// Hook de pré-sauvegarde pour hasher le mot de passe
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthodes d'instance
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

// Méthodes statiques
UserSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
