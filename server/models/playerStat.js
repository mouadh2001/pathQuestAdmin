import mongoose from "mongoose";

const playerStatSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Player",
    required: true,
  },
  username: { type: String, required: true },
  levelKey: { type: String, default: "unknown_level" },
  score: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  incorrect: { type: Number, default: 0 },
  time: { type: Number, default: 0 },
  metrics: {
    sessionDuration: { type: Number, default: 0 },
    observationTime: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 },
    firstTrySuccessCount: { type: Number, default: 0 },
    levelAttempts: { type: Number, default: 1 }
  },
  questionStats: { type: mongoose.Schema.Types.Mixed, default: {} },
  pushedAt: { type: Date, default: Date.now },
});

export default mongoose.model("PlayerStat", playerStatSchema);
