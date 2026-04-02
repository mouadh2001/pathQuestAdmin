import mongoose from "mongoose";

const playerStatSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Player",
    required: true,
  },
  username: { type: String, required: true },
  score: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  incorrect: { type: Number, default: 0 },
  time: { type: Number, default: 0 },
  questionStats: { type: mongoose.Schema.Types.Mixed, default: {} },
  pushedAt: { type: Date, default: Date.now },
});

export default mongoose.model("PlayerStat", playerStatSchema);
