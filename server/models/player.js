import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  character: { type: String, default: "man" },
  progress: { type: [String], default: [] },
  stats: {
    score: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    incorrect: { type: Number, default: 0 },
    time: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 }
  },
  levelStats: {
    type: Map,
    of: new mongoose.Schema({
      score: { type: Number, default: 0 },
      time: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      incorrect: { type: Number, default: 0 },
      firstTryCorrectAnswers: { type: Number, default: 0 },
      attemptsPerQuestion: { type: mongoose.Schema.Types.Mixed, default: {} },
      badges: { type: mongoose.Schema.Types.Mixed, default: {} }
    }, { _id: false }),
    default: {}
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Player", playerSchema);
