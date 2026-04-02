import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Player from "../models/player.js";
import PlayerStat from "../models/playerStat.js";
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
      { id: player._id, role: "player", username: player.username },
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
const updatePlayerStats = async (req, res) => {
  try {
    const { levelKey, score, correct, incorrect, time, questionStats = {} } = req.body;
    const player = await Player.findById(req.player.id);

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }
    
    const levelId = levelKey || "unknown_level";

    // Set the new level stats, replacing any previous attempt for this level
    player.levelStats.set(levelId, {
      score: Number(score) || 0,
      correct: Number(correct) || 0,
      incorrect: Number(incorrect) || 0,
      time: Number(time) || 0,
      questionStats
    });

    // Recalculate global stats to avoid unbounded accumulation
    let totalScore = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalTime = 0;

    for (const data of player.levelStats.values()) {
      totalScore += data.score || 0;
      totalCorrect += data.correct || 0;
      totalIncorrect += data.incorrect || 0;
      totalTime += data.time || 0;
    }

    player.stats.score = totalScore;
    player.stats.correct = totalCorrect;
    player.stats.incorrect = totalIncorrect;
    player.stats.time = totalTime;

    await player.save();

    const statEntry = await PlayerStat.create({
      player: player._id,
      username: player.username,
      levelKey: levelId,
      score: Number(score) || 0,
      correct: Number(correct) || 0,
      incorrect: Number(incorrect) || 0,
      time: Number(time) || 0,
      questionStats,
    });

    res.json({
      message: "Stats updated successfully",
      player: {
        id: player._id,
        username: player.username,
      },
      stats: player.stats,
      levelStats: player.levelStats,
      statEntry,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error updating stats" });
  }
};

router.put("/stats", playerAuthMiddleware, updatePlayerStats);
router.post("/stats", playerAuthMiddleware, updatePlayerStats);
router.post("/stats/create", playerAuthMiddleware, updatePlayerStats);

router.get("/stats/history", playerAuthMiddleware, async (req, res) => {
  try {
    const history = await PlayerStat.find({ player: req.player.id })
      .sort({ pushedAt: -1 })
      .select("score correct incorrect time pushedAt")
      .lean();

    res.json({ history });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching stats history" });
  }
});

export default router;
