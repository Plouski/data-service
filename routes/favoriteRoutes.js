const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");
const Favorite = require("../models/Favorite");

const router = express.Router();

router.post("/toggle/:tripId", authMiddleware, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.userId;

    const existing = await Favorite.findOne({ userId, tripId });

    if (existing) {
      await Favorite.deleteOne({ _id: existing._id });
      res.json({ favorited: false });
    } else {
      await Favorite.create({ userId, tripId });
      res.json({ favorited: true });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user.userId })
      .populate("tripId")
      .sort({ createdAt: -1 });

    const roadtrips = favorites
      .filter((fav) => fav.tripId)
      .map((fav) => ({
        ...fav.tripId.toObject(),
        _id: fav.tripId._id,
        isFavorite: true,
      }));

    res.json({ roadtrips });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
