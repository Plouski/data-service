const express = require("express");
const router = express.Router();
const TripController = require("../controllers/tripController");

// 📌 Routes publiques
router.get("/", TripController.getPublicRoadtrips);
router.get("/popular", TripController.getPopularRoadtrips)
router.get("/:id", TripController.getRoadtripById);

router.post("/:id/view", TripController.incrementViewCount);

module.exports = router;
