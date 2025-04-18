const express = require('express');
const UserController = require('../controllers/userController');
const { authMiddleware, roleMiddleware } = require("../middlewares/authMiddleware");
const isAdmin = roleMiddleware(["admin"]);

const router = express.Router();

router.get("/", authMiddleware, isAdmin, UserController.getUsers);

router.put("/status/:id", authMiddleware, isAdmin, UserController.updateUserStatus);

router.delete("/:id", authMiddleware, isAdmin, UserController.deleteUser);

router.get("/:id", authMiddleware, isAdmin, UserController.getUserById);

router.put("/:id", authMiddleware, isAdmin, UserController.updateUser);

module.exports = router;