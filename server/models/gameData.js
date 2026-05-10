import mongoose from "mongoose";

const questionFeedbackSchema = new mongoose.Schema({
  text: { type: String, default: "" },
  imgs: [{ type: String }],
}, { _id: false });

const bonusInfoSchema = new mongoose.Schema({
  text: { type: String, default: "" },
  image: { type: String, default: "" },
}, { _id: false });

const gameDataSchema = new mongoose.Schema({
  levelId: { type: String, required: true, unique: true },
  title: { type: String },
  backgroundKey: { type: String },
  isDeadlyFloor: { type: Boolean, default: false },
  spawn: {
    x: { type: Number },
    y: { type: Number }
  },
  questionCount: { type: Number, default: 7 },
  hint: { type: String, default: "" },
  loupeLink: { type: String, default: "" },
  bonusInfo: [bonusInfoSchema],
  badgeUrl: { type: String, default: "" },

  platforms: [mongoose.Schema.Types.Mixed],
  items: [mongoose.Schema.Types.Mixed],
  enemies: [mongoose.Schema.Types.Mixed],

  questions: { type: Map, of: mongoose.Schema.Types.Mixed } 
  // Stored as a Map to easily support q1, q2, etc., allowing flexible updates without strict rigid arrays.
  // Each question will have: { q: String, imgs: [String], a: [String], c: [Number], feedbacks: [...] }
}, { minimize: false });

export default mongoose.model("GameData", gameDataSchema);
