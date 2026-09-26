import mongoose from "mongoose";

const gameSessionSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    opponent: {
      type: String,
      enum: ["computer", "human"],
      required: true,
    },
    difficulty: {
      type: String,
      enum: [
        "beginner",
        "intermediate",
        "advanced",
        "master",
        "grandmaster",
        "legendary",
        "pass-and-play",
      ],
      required: function () {
        return this.opponent === "computer";
      },
    },
    currentFEN: {
      type: String,
      default: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    },
    moves: [
      {
        move: String,
        fen: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["in_progress", "won", "lost", "draw", "abandoned"],
      default: "in_progress",
    },
  },
  {
    timestamps: true,
  }
);

const GameSession = mongoose.model("GameSession", gameSessionSchema);
export default GameSession;
