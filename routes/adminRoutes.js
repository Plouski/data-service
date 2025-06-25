const express = require("express")
const adminController = require("../controllers/adminController")
const TripController = require("../controllers/tripController");
const { authMiddleware, roleMiddleware } = require("../middlewares/authMiddleware");
const isAdmin = roleMiddleware(["admin"]);

const router = express.Router()

// Statiques
router.get("/stats", authMiddleware, isAdmin, adminController.getStats)
router.get("/users/recent", authMiddleware, isAdmin, adminController.getRecentUsers)
router.get("/roadtrips/recent", authMiddleware, isAdmin, adminController.getRecentRoadtrips)

// Utilisateurs
router.get("/users", authMiddleware, isAdmin, adminController.getUsers);
router.put("/users/status/:id", authMiddleware, isAdmin, adminController.updateUserStatus);
router.get("/users/:id", authMiddleware, isAdmin, adminController.getUserById);
router.put("/users/:id", authMiddleware, isAdmin, adminController.updateUser);
router.delete("/users/:id", authMiddleware, isAdmin, adminController.deleteUser);

// Roadtrips
router.get("/roadtrips", authMiddleware, isAdmin, adminController.getRoadtrips);
router.post("/roadtrips", authMiddleware, isAdmin, adminController.createTrip);
router.put("/roadtrips/:id", authMiddleware, isAdmin, adminController.updateTrip);
router.delete("/roadtrips/:id", authMiddleware, isAdmin, adminController.deleteTrip);
router.patch("/roadtrips/status/:id", authMiddleware, isAdmin, adminController.updateRoadtripStatus);

module.exports = router