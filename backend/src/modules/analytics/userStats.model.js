import mongoose from "mongoose";

// Aggregates maintained incrementally by the analytics worker so the dashboard
// never scans every game. Rebuildable from source collections at any time
// (see analytics.service.js#rebuildUserStats).
const userStatsSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    chess: {
      gamesAnalyzed: { type: Number, default: 0 },
      movesAnalyzed: { type: Number, default: 0 },
      accuracySum: { type: Number, default: 0 },
      cplSum: { type: Number, default: 0 },
      classifications: { type: Map, of: Number, default: {} },
      themes: { type: Map, of: Number, default: {} },
      phaseCpl: { type: Map, of: Number, default: {} }, // phase -> summed CPL
      phaseMoves: { type: Map, of: Number, default: {} },
    },
    ai: {
      questions: { type: Number, default: 0 },
      concepts: { type: Map, of: Number, default: {} },
    },
    processedEvents: { type: [String], select: false }, // last event ids, for idempotency
  },
  { timestamps: true }
);

export default mongoose.model("UserStats", userStatsSchema);
