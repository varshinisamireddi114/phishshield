
import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  score: { type: Number, min: 0, required: true },
  total: { type: Number, min: 1, required: true },
  completedAt: { type: Date, default: Date.now }
}, { versionKey: false });

export default mongoose.model("QuizAttempt", quizAttemptSchema);