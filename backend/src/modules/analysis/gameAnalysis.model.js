import mongoose from "mongoose";

const moveAnalysisSchema = new mongoose.Schema({
  moveNumber: Number,
  playerMove: String,
  bestMove: String,
  accuracy: Number,
  classification: String,
  fenBefore: String,
  fenAfter: String,
  evaluationBefore: Number,
  evaluationAfter: Number,
});

const gameAnalysisSchema = new mongoose.Schema({
  gameSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GameSession",
    required: true,
    unique: true,
  },
  playerAccuracy: Number,
  computerAccuracy: Number,
  bestMoveCount: Number,
  inaccuracies: Number,
  mistakes: Number,
  blunders: Number,
  moveAnalysis: [moveAnalysisSchema],
  geminiReport: {
    summary: String,
    strengths: [String],
    weaknesses: [String],
    keyInsights: [
      {
        moveNumber: Number,
        playerMove: String,
        bestMove: String,
        explanation: String,
      },
    ],
    trainingRecommendations: [String],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const GameAnalysis = mongoose.model("GameAnalysis", gameAnalysisSchema);
export default GameAnalysis;
