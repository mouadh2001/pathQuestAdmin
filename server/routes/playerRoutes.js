import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Player from "../models/player.js";
import authMiddleware from "../middleware/authMiddleware.js";
import playerAuthMiddleware from "../middleware/playerAuthMiddleware.js";

const router = express.Router();

/* ===============================
   PLAYER LOGIN
================================= */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1️⃣ Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Missing email or password" });
    }

    // 2️⃣ Find player by email
    const player = await Player.findOne({ email });
    if (!player) {
      return res.status(400).json({ message: "Player not found" });
    }

    // 3️⃣ Compare passwords
    const isMatch = await bcrypt.compare(password, player.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Wrong password" });
    }

    // 4️⃣ Generate JWT token
    const token = jwt.sign(
      { id: player._id, role: "player" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   CREATE PLAYER (Admin Only)
================================= */
router.post("/create", authMiddleware, async (req, res) => {
  const { username, email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const player = await Player.create({
    username,
    email,
    password: hashedPassword,
    createdBy: req.admin.id,
  });

  res.json(player);
});

/* ===============================
   GET ALL PLAYERS (Admin Only)
================================= */
router.get("/all", authMiddleware, async (req, res) => {
  const players = await Player.find();
  res.json(players);
});

/* ===============================
   UPDATE PLAYER STATS
================================= */
router.put("/stats", playerAuthMiddleware, async (req, res) => {
  try {
    const { score, correct, incorrect, time } = req.body;
    
    // We increment the stats or just set them. Assuming they represent latest session or cumulative.
    // The user wants to push stats, let's just increment them to accumulate stats across plays.
    // Wait, the client sends the total or just the current session?
    // In StatsService, it tracks current session stats. So server should probably increment.
    
    const updatedPlayer = await Player.findByIdAndUpdate(
      req.player.id,
      {
        $inc: {
          "stats.score": Number(score) || 0,
          "stats.correct": Number(correct) || 0,
          "stats.incorrect": Number(incorrect) || 0,
          "stats.time": Number(time) || 0,
        }
      },
      { new: true }
    );
    
    res.json({ message: "Stats updated successfully", stats: updatedPlayer.stats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error updating stats" });
  }
});

export default router;
