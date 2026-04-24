import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Player from "../models/player.js";
import PlayerStat from "../models/playerStat.js";
import authMiddleware from "../middleware/authMiddleware.js";
import playerAuthMiddleware from "../middleware/playerAuthMiddleware.js";
import {
  sendAccountCreationEmail,
  sendPlayerRegistrationConfirmation,
} from "../services/emailService.js";

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
   PLAYER SELF-REGISTRATION
================================= */
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Validate input
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // Check if player already exists
    const existingPlayer = await Player.findOne({
      $or: [{ email }, { username }],
    });
    if (existingPlayer) {
      return res.status(400).json({
        message:
          existingPlayer.email === email
            ? "Email already registered"
            : "Username already taken",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create player
    const player = await Player.create({
      username,
      email,
      password: hashedPassword,
    });

    // Send welcome email
    await sendPlayerRegistrationConfirmation(email, username);

    // Generate token
    const token = jwt.sign(
      { id: player._id, role: "player", username: player.username },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.status(201).json({
      message: "Account created successfully! Welcome to PathQuest.",
      token,
      player: {
        id: player._id,
        username: player.username,
        email: player.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

/* ===============================
   CREATE PLAYER (Admin Only)
================================= */
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: "Missing username, email, or password" });
    }

    // Check if player already exists
    const existingPlayer = await Player.findOne({ email });
    if (existingPlayer) {
      return res
        .status(400)
        .json({ message: "Player with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const player = await Player.create({
      username,
      email,
      password: hashedPassword,
      createdBy: req.admin.id,
    });

    // Send email notification to admin with credentials
    const admin = await Player.findOne({ createdBy: req.admin.id }).limit(1);
    if (admin) {
      // Get admin email from the request or database
      const adminEmail = req.adminEmail || process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await sendAccountCreationEmail(adminEmail, email, password);
      }
    }

    res.json({ message: "Player created successfully", player });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error creating player" });
  }
});

/* ===============================
   GET ALL PLAYERS (Admin Only)
================================= */
router.get("/all", authMiddleware, async (req, res) => {
  const players = await Player.find().lean();
  res.json(players);
});

/* ===============================
   GET PLAYER HISTORY (Admin Only)
================================= */
router.get("/admin/player/:id/history", authMiddleware, async (req, res) => {
  try {
    const history = await PlayerStat.find({ player: req.params.id })
      .sort({ pushedAt: 1 }) // Oldest first for progressing charts
      .lean();
    res.json({ history });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching player history" });
  }
});

/* ===============================
   UPDATE PLAYER STATS
================================= */
const updatePlayerStats = async (req, res) => {
  try {
    const {
      levelKey,
      score,
      correct,
      incorrect,
      time,
      questionStats = {},
      metrics = {},
    } = req.body;
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
      metrics,
      questionStats,
    });

    // Recalculate global stats to avoid unbounded accumulation
    // Note: totalTime and totalSessions now incrementally grow based on the push event
    // because replays shouldn't overwrite the global time spent playing.
    let totalScore = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;

    for (const data of player.levelStats.values()) {
      totalScore += data.score || 0;
      totalCorrect += data.correct || 0;
      totalIncorrect += data.incorrect || 0;
    }

    player.stats.score = totalScore;
    player.stats.correct = totalCorrect;
    player.stats.incorrect = totalIncorrect;
    player.stats.time =
      (player.stats.time || 0) +
      (Number(metrics.sessionDuration) || Number(time) || 0);
    player.stats.totalSessions = (player.stats.totalSessions || 0) + 1;

    await player.save();

    const statEntry = await PlayerStat.create({
      player: player._id,
      username: player.username,
      levelKey: levelId,
      score: Number(score) || 0,
      correct: Number(correct) || 0,
      incorrect: Number(incorrect) || 0,
      time: Number(time) || 0,
      metrics,
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
