const express = require("express")
const adminController = require("../controllers/adminController")
const { authMiddleware } = require("../middlewares/authMiddleware")

const router = express.Router()

router.get("/stats", authMiddleware, adminController.getStats)
router.get("/users/recent", authMiddleware, adminController.getRecentUsers)
router.get("/roadtrips/recent", authMiddleware, adminController.getRecentRoadtrips)

module.exports = router