const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Veuillez fournir une adresse email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Adresse email invalide']
  },
  password: {
    type: String,
    required: function () {
      // Le mot de passe est requis seulement si pas d'OAuth
      return !this.oauth || Object.keys(this.oauth).length === 0;
    },
    minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
    select: false
  },
  oauth: {
    provider: String,
    googleId: String,
    facebookId: String,
    githubId: String
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  role: {
    type: String,
    enum: ['user', 'premium', 'admin'],
    default: 'user'
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  activeSubscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null
  },
  profilePicture: {
    type: String,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  // Ajouter des indexes pour optimiser les performances
  indexes: [
    { email: 1 },
    { role: 1 },
    { createdAt: -1 }
  ]
});

// Hook de pré-sauvegarde pour hasher le mot de passe
UserSchema.pre('save', async function (next) {
  // Hasher le mot de passe uniquement s'il a été modifié
  if (!this.isModified('password')) return next();

  try {
    // Génération du sel et hashage du mot de passe
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour comparer les mots de passe
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Méthode statique pour trouver un utilisateur par email
UserSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Méthode pour obtenir un profil public sécurisé
UserSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

const User = mongoose.model('User', UserSchema);

module.exports = User;