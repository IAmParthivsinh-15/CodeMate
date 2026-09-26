import mongoose from "mongoose";

// Per-move structured analysis (spec §12). Evaluations are centipawns from
// WHITE's point of view; mate scores are stored as ±(10000 - 10·distance).
const moveAnalysisSchema = new mongoose.Schema(
  {
    moveNumber: Number, // full-move number shown to users (1. e4 e5 → both are move 1)
    ply: Number,
    color: { type: String, enum: ["w", "b"] },
    fenBefore: String,
    fenAfter: String,
    playedMove: String, // SAN
    playedMoveUci: String,
    bestMove: String, // SAN
    bestMoveUci: String,
    evaluationBefore: Number,
    evaluationAfter: Number,
    mateBefore: Number, // mate distance, White POV, when the engine reported one
    mateAfter: Number,
    centipawnLoss: Number,
    accuracy: Number, // 0-100, win-probability based
    classification: { type: String, enum: ["book", "best", "excellent", "good", "inaccuracy", "mistake", "blunder"] },
    principalVariation: [String], // SAN, from the position before the move
    themes: [String],
    phase: { type: String, enum: ["opening", "middlegame", "endgame"] },
    // Legacy fields (pre-Phase-6 documents)
    playerMove: String,
  },
  { _id: false }
);

const sideStatsSchema = new mongoose.Schema(
  {
    accuracy: Number,
    averageCentipawnLoss: Number,
    counts: { book: Number, best: Number, excellent: Number, good: Number, inaccuracy: Number, mistake: Number, blunder: Number },
  },
  { _id: false }
);

const gameAnalysisSchema = new mongoose.Schema(
  {
    gameSession: { type: mongoose.Schema.Types.ObjectId, ref: "GameSession", required: true, unique: true },
    status: { type: String, enum: ["pending", "running", "completed", "failed"], default: "completed" },
    error: String,
    engineVersion: String,
    depth: Number,
    thresholdsVersion: Number,
    white: sideStatsSchema,
    black: sideStatsSchema,
    themes: [String], // union of move themes, most frequent first
    moveAnalysis: [moveAnalysisSchema],
    durationMs: Number,

    // AI coach report, written asynchronously by the AI worker.
    aiStatus: { type: String, enum: ["none", "pending", "completed", "failed", "skipped"], default: "none" },
    aiReport: {
      summary: String,
      strengths: [String],
      weaknesses: [String],
      keyMoments: [{ ply: Number, moveNumber: Number, playedMove: String, bestMove: String, explanation: String }],
      trainingRecommendations: [String],
      provider: String,
      model: String,
      generatedAt: Date,
    },

    // Legacy pre-Phase-6 fields, kept readable.
    playerAccuracy: Number,
    computerAccuracy: Number,
    bestMoveCount: Number,
    inaccuracies: Number,
    mistakes: Number,
    blunders: Number,
    geminiReport: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

const GameAnalysis = mongoose.model("GameAnalysis", gameAnalysisSchema);
export default GameAnalysis;
