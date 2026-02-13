import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  stats: {
    score: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Player", playerSchema);
