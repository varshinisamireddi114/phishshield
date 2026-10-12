
import mongoose from "mongoose";

const scanSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  url: { type: String, required: true, maxlength: 2048 },
  hostname: { type: String, required: true, maxlength: 253 },
  score: { type: Number, min: 0, max: 100, required: true },
  risk: {
    type: String,
    enum: ["Low", "Medium", "High"],
    required: true
  },
  reasons: [{ type: String, maxlength: 300 }],
  checks: {
    reputation: {
      type: String,
      enum: ["match", "no_match", "unavailable"],
      default: "unavailable"
    },
    https: Boolean,
    ipHost: Boolean,
    punycode: Boolean,
    embeddedCredentials: Boolean,
    suspiciousKeywords: Boolean,
    unusualPort: Boolean
  }
}, { timestamps: true, versionKey: false });

scanSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model("Scan", scanSchema);