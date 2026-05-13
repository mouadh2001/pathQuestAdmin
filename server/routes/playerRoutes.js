import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Player from "../models/player.js";
import PlayerStat from "../models/playerStat.js";
import authMiddleware from "../middleware/authMiddleware.js";
import playerAuthMiddleware from "../middleware/playerAuthMiddleware.js";
import {
  sendAccountCreationEmail,
  sendPlayerCredentialsEmail,
  sendPlayerRegistrationConfirmation,
} from "../services/emailService.js";

const router = express.Router();

/* ===============================
   TEST EMAIL ENDPOINT (For Debugging)
================================= */
router.post("/test-email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    console.log("Testing email sending to:", email);
    console.log("From:", process.env.EMAIL_USER);
    console.log(
      "Email Password:",
      process.env.EMAIL_PASSWORD ? "✓ Set" : "✗ Not set",
    );

    const result = await sendPlayerRegistrationConfirmation(email, "TestUser");

    res.json({
      message: "Test email result",
      success: result.success,
      error: result.error || null,
      data: result.data || null,
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    res.status(500).json({ message: error.message });
  }
});

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

    // Send welcome email asynchronously without blocking the response
    console.log("Sending welcome email to:", email);
    sendPlayerRegistrationConfirmation(email, username)
      .then(emailResult => {
        if (!emailResult.success) {
          console.error("Email sending failed:", emailResult.error);
        } else {
          console.log("Welcome email sent successfully to:", email);
        }
      })
      .catch(err => console.error("Unhandled error sending welcome email:", err));

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

    // Send email with credentials to the player asynchronously
    console.log("Sending player credentials email to:", email);
    sendPlayerCredentialsEmail(email, password)
      .then(playerEmailResult => {
        if (!playerEmailResult.success) {
          console.error("Player credentials email sending failed:", playerEmailResult.error);
        } else {
          console.log("Player credentials email sent successfully to:", email);
        }
      })
      .catch(err => console.error(err));

    // Send email notification to admin with credentials asynchronously
    const adminEmail = req.adminEmail || process.env.ADMIN_EMAIL;
    if (adminEmail) {
      console.log("Sending admin notification email to:", adminEmail);
      sendAccountCreationEmail(adminEmail, email, password)
        .then(emailResult => {
          if (!emailResult.success) {
            console.error("Admin email sending failed:", emailResult.error);
          } else {
            console.log("Admin notification email sent successfully to:", adminEmail);
          }
        })
        .catch(err => console.error(err));
    } else {
      console.warn("No admin email found to send notification");
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
      levelScore,
      totalScore,
      timeSpent,
      progress,
      attemptsPerQuestion = {},
      incorrectAnswers,
      correctAnswers,
      firstTryCorrectAnswers,
      character,
      badges = {}
    } = req.body;
    
    const player = await Player.findById(req.player.id);

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const levelId = levelKey || "unknown_level";

    const existingLevelStats = player.levelStats.get(levelId);
    const existingScore = existingLevelStats ? existingLevelStats.score : -1;
    const incomingScore = Number(levelScore) || 0;

    player.levelStats.set(levelId, {
      score: Math.max(existingScore, incomingScore),
      time: Number(timeSpent) || (existingLevelStats?.time || 0),
      correct: Number(correctAnswers) || (existingLevelStats?.correct || 0),
      incorrect: Number(incorrectAnswers) || (existingLevelStats?.incorrect || 0),
      firstTryCorrectAnswers: Number(firstTryCorrectAnswers) || (existingLevelStats?.firstTryCorrectAnswers || 0),
      attemptsPerQuestion,
      badges,
    });

    player.character = character || player.character;
    if (progress && Array.isArray(progress)) {
      player.progress = progress;
    }

    let totalGlobalScore = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;

    for (const data of player.levelStats.values()) {
      totalGlobalScore += data.score || 0;
      totalCorrect += data.correct || 0;
      totalIncorrect += data.incorrect || 0;
    }

    player.stats.score = totalGlobalScore;
    player.stats.correct = totalCorrect;
    player.stats.incorrect = totalIncorrect;
    player.stats.time = (player.stats.time || 0) + (Number(timeSpent) || 0);
    player.stats.totalSessions = (player.stats.totalSessions || 0) + 1;

    await player.save();

    const statEntry = await PlayerStat.create({
      player: player._id,
      username: player.username,
      levelKey: levelId,
      levelScore: incomingScore,
      totalScore: Number(totalScore) || totalGlobalScore,
      timeSpent: Number(timeSpent) || 0,
      progress: player.progress,
      attemptsPerQuestion,
      incorrectAnswers: Number(incorrectAnswers) || 0,
      correctAnswers: Number(correctAnswers) || 0,
      firstTryCorrectAnswers: Number(firstTryCorrectAnswers) || 0,
      character: player.character,
      badges
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
      .select("levelScore totalScore correctAnswers incorrectAnswers timeSpent pushedAt")
      .lean();

    res.json({ history });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching stats history" });
  }
});

export default router;
