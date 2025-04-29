const User = require("../models/User")
const Trip = require("../models/Trip")

const adminService = {
  async getStats() {
    const [totalUsers, activeUsers, totalRoadtrips, publishedRoadtrips] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),
      Trip.countDocuments(),
      Trip.countDocuments({ isPublished: true }),
    ])

    return {
      totalUsers,
      activeUsers,
      totalRoadtrips,
      publishedRoadtrips,
    }
  },

  async getTotalRoadtrips() {
    const totalRoadtrips = await Trip.countDocuments()
    return { totalRoadtrips }
  },

  async getRecentUsers() {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("id firstName lastName email isVerified createdAt")

    return { users }
  },

  async getRecentRoadtrips() {
    const roadtrips = await Trip.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id title country bestSeason isPublished createdAt")

    return { roadtrips }
  }
}

module.exports = adminService
