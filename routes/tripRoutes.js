const express = require("express");
const router = express.Router();
const TripController = require("../controllers/tripController");
const { authMiddleware, roleMiddleware } = require("../middlewares/authMiddleware");
const isAdmin = roleMiddleware(["admin"]);

// 📌 Routes publiques
router.get("/", TripController.getRoadtrips); // GET /roadtrips
router.get("/public", TripController.getPublicTrips)
// router.get("/search", TripController.searchPublicTrips); // GET /roadtrips/search

// 🧑‍💻 Authentifié : accès aux détails (avec ou sans premium)
router.get("/:id", TripController.getRoadtripById); // GET /roadtrips/:id

// ⚙️ Admin uniquement
router.post("/", authMiddleware, isAdmin, TripController.createTrip); // POST /roadtrips
router.put("/:id", authMiddleware, isAdmin, TripController.updateTrip); // PUT /roadtrips/:id
router.delete("/:id", authMiddleware, isAdmin, TripController.deleteTrip); // DELETE /roadtrips/:id

router.post("/:id/view", TripController.incrementViewCount);

router.post("/:id/favorite", authMiddleware, TripController.toggleFavorite)
router.get("/user/favorites", authMiddleware, TripController.getFavoritesForUser)

module.exports = router;
