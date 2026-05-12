import mongoose from "mongoose";

const playerStatSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Player",
    required: true,
  },
  username: { type: String, required: true },
  levelKey: { type: String, default: "unknown_level" },
  levelScore: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  timeSpent: { type: Number, default: 0 },
  progress: { type: [String], default: [] },
  attemptsPerQuestion: { type: mongoose.Schema.Types.Mixed, default: {} },
  incorrectAnswers: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  firstTryCorrectAnswers: { type: Number, default: 0 },
  character: { type: String, default: "man" },
  badges: { type: mongoose.Schema.Types.Mixed, default: {} },
  pushedAt: { type: Date, default: Date.now },
});

export default mongoose.model("PlayerStat", playerStatSchema);
