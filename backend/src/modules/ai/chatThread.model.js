import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    ply: Number, // selected move when the question was asked
    route: String, // game | chess | mixed
    keyConcepts: [String],
    recommendations: [String],
    sources: [{ title: String, section: String, source: String, _id: false }],
    facts: mongoose.Schema.Types.Mixed, // engine facts shown alongside the answer
    provider: String,
    model: String,
    degraded: Boolean, // true when answered by the deterministic fallback
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Chat metadata and history (spec §20: chat metadata lives in MongoDB).
const chatThreadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    scope: { type: String, enum: ["game", "chess", "coach"], required: true },
    game: { type: mongoose.Schema.Types.ObjectId, ref: "GameSession", default: null },
    messages: [messageSchema],
  },
  { timestamps: true }
);

chatThreadSchema.index({ user: 1, scope: 1, game: 1 }, { unique: true });

export default mongoose.model("ChatThread", chatThreadSchema);
