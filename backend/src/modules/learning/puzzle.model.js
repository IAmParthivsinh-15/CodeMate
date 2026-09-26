import mongoose from "mongoose";

// Training positions generated from the user's own mistakes (spec §16, §32).
const puzzleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sourceGame: { type: mongoose.Schema.Types.ObjectId, ref: "GameSession", required: true },
    sourcePly: { type: Number, required: true },
    sourceMoveNumber: Number,
    fen: { type: String, required: true },
    sideToMove: { type: String, enum: ["w", "b"], required: true },
    expectedMove: { type: String, required: true }, // UCI
    expectedSan: String,
    playedMove: String, // SAN of the original mistake
    evaluationBest: Number, // White POV
    centipawnLoss: Number,
    theme: String,
    themes: [String],
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    attempts: { type: Number, default: 0 },
    solvedAt: Date,
    lastAttemptAt: Date,
  },
  { timestamps: true }
);

puzzleSchema.index({ user: 1, sourceGame: 1, sourcePly: 1 }, { unique: true });
puzzleSchema.index({ user: 1, solvedAt: 1, theme: 1 });

export default mongoose.model("Puzzle", puzzleSchema);
