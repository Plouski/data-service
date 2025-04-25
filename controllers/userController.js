const User = require("../models/User");
const AiHistory = require("../models/AiHistory");
const Favorite = require("../models/Favorite");
const Subscription = require("../models/Subscription");
const Trip = require("../models/Trip");
const mongoose = require("mongoose");

/**
 * GET /api/users
 * Récupère une liste paginée des utilisateurs avec recherche optionnelle
 */
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    const query = {
      $or: [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } }
      ]
    };

    const users = await User.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-password") // ne pas renvoyer le mot de passe
      .lean();

    const total = await User.countDocuments(query);

    res.status(200).json({ users, total });
  } catch (err) {
    console.error("Erreur getUsers:", err);
    res.status(500).json({ message: "Erreur lors de la récupération des utilisateurs" });
  }
};

/**
 * PUT /api/users/status/:id
 * Active ou désactive un utilisateur
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { isVerified } = req.body;

    console.log("🔧 updateUserStatus", userId, isVerified);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID utilisateur invalide" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    user.isActive = isVerified; // ← on aligne les noms
    await user.save();

    res.status(200).json({ message: `Utilisateur ${isVerified ? "activé" : "désactivé"}` });
  } catch (err) {
    console.error("Erreur updateUserStatus:", err);
    res.status(500).json({ message: "Erreur lors de la mise à jour du statut" });
  }
};

/**
 * DELETE /api/users/:id
 * Supprime un utilisateur par ID (dans le body)
 */
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID utilisateur invalide" });
    }

    console.log("🧨 Suppression utilisateur + données associées:", userId);

    // 1. Supprimer les données liées
    await Promise.all([
      AiHistory.deleteMany({ userId }),
      Favorite.deleteMany({ userId }),
      Subscription.deleteMany({ userId }),
      Trip.deleteMany({ userId }),
    ]);

    // 2. Supprimer l'utilisateur lui-même
    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) return res.status(404).json({ message: "Utilisateur non trouvé" });

    res.status(200).json({ message: "Utilisateur et données associées supprimés avec succès" });
  } catch (err) {
    console.error("Erreur deleteUser:", err);
    res.status(500).json({ message: "Erreur lors de la suppression de l'utilisateur" });
  }
};

/**
 * GET /api/users/:id
 * Récupère un utilisateur par ID
 */
exports.getUserById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "ID utilisateur invalide" });
  }

  try {
    const user = await User.findById(id).select("-password");
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    res.status(200).json(user);
  } catch (err) {
    console.error("Erreur getUserById:", err);
    res.status(500).json({ message: "Erreur lors de la récupération de l'utilisateur" });
  }
};

/**
 * PUT /api/users/:id
 * Met à jour un utilisateur
 */
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "ID utilisateur invalide" });
  }

  try {
    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
      context: "query",
    }).select("-password");

    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    res.status(200).json(user);
  } catch (err) {
    console.error("Erreur updateUser:", err);
    res.status(500).json({ message: "Erreur lors de la mise à jour de l'utilisateur" });
  }
};