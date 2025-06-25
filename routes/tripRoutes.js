const express = require("express");
const router = express.Router();
const TripController = require("../controllers/tripController");
const { authMiddleware, roleMiddleware } = require("../middlewares/authMiddleware");
const isAdmin = roleMiddleware(["admin"]);

// 📌 Routes publiques
router.get("/", TripController.getRoadtrips);
router.get("/popular", TripController.getPopularTrips)
router.get("/:id", TripController.getRoadtripById);

// 🧑‍💻 Authentifié : accès aux détails (avec ou sans premium)
router.post("/:id/favorite", authMiddleware, TripController.toggleFavorite)
router.get("/user/favorites", authMiddleware, TripController.getFavoritesForUser)

// ⚙️ Admin uniquement
router.put("/:id", authMiddleware, isAdmin, TripController.updateTrip);
router.delete("/:id", authMiddleware, isAdmin, TripController.deleteTrip);
router.patch("/status/:id", authMiddleware, isAdmin, TripController.updateRoadtripStatus);

router.post("/:id/view", TripController.incrementViewCount);

module.exports = router;
