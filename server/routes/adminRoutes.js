import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/admin.js";
import Player from "../models/player.js";
import PlayerStat from "../models/playerStat.js";
import { getGameData, updateGameData, pushGameData } from "../controllers/gameDataController.js";

const router = express.Router();

/* Admin Login */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) return res.status(400).json({ message: "Admin not found" });

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) return res.status(400).json({ message: "Wrong password" });

  const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  res.json({ token });
});

/* Player Management */
router.delete("/players/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete player stats first
    await PlayerStat.deleteMany({ playerId: id });
    
    // Delete the player
    const deletedPlayer = await Player.findByIdAndDelete(id);
    
    if (!deletedPlayer) {
      return res.status(404).json({ message: "Player not found" });
    }
    
    res.json({ message: "Player deleted successfully" });
  } catch (error) {
    console.error("Error deleting player:", error);
    res.status(500).json({ message: "Failed to delete player", error: error.message });
  }
});

/* Game Data Management */
router.get("/gamedata/:level", getGameData);
router.put("/gamedata/:level", updateGameData);
router.post("/gamedata/:level/push", pushGameData);

export default router;
