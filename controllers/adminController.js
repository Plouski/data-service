const adminService = require("../services/adminService")

const getStats = async (req, res) => {
  try {
    const stats = await adminService.getStats()
    res.status(200).json(stats)
  } catch (error) {
    console.error("Erreur dans getStats:", error)
    res.status(500).json({ message: "Erreur lors de la récupération des statistiques." })
  }
}

const getRecentUsers = async (req, res) => {
  try {
    const data = await adminService.getRecentUsers()
    res.status(200).json(data)
  } catch (error) {
    console.error("Erreur dans getRecentUsers:", error)
    res.status(500).json({ message: "Erreur lors de la récupération des derniers utilisateurs." })
  }
}

const getRecentRoadtrips = async (req, res) => {
  try {
    const data = await adminService.getRecentRoadtrips()
    res.status(200).json(data)
  } catch (error) {
    console.error("Erreur dans getRecentRoadtrips:", error)
    res.status(500).json({ message: "Erreur lors de la récupération des derniers roadtrips." })
  }
}

module.exports = {
  getStats,
  getRecentUsers,
  getRecentRoadtrips
}