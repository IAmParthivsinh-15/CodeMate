import mongoose from "mongoose";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// New code writes: waiting | in_progress | completed | abandoned.
// won/lost/draw are kept only so documents written before Phase 0 still validate.
export const GAME_STATUSES = ["waiting", "in_progress", "completed", "abandoned", "won", "lost", "draw"];
export const END_REASONS = [
  "checkmate", "stalemate", "insufficient_material", "threefold_repetition", "fifty_move_rule",
  "resignation", "timeout", "agreement", "abandonment", "aborted",
];

const moveSchema = new mongoose.Schema(
  {
    ply: Number, // 1-based half-move index
    san: String,
    uci: String,
    color: { type: String, enum: ["w", "b"] },
    fen: String, // position AFTER the move
    move: String, // legacy field (= san)
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // null for engine moves
    clientMoveId: String, // idempotency key from realtime clients
    clockMs: Number, // mover's remaining time after the move (timed games)
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const gameSessionSchema = new mongoose.Schema(
  {
    // Creator of the game. For AI/local games this is the only human.
    player: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    mode: { type: String, enum: ["ai", "local", "online"], default: "ai" },
    opponent: { type: String, enum: ["computer", "human"], required: true }, // legacy, derived from mode
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "master", "grandmaster", "legendary", "pass-and-play"],
      required: function () { return this.opponent === "computer"; },
    },
    whitePlayer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    blackPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    playerColor: { type: String, enum: ["w", "b"], default: "w" }, // the creator's side in AI games

    initialFen: { type: String, default: START_FEN },
    currentFEN: { type: String, default: START_FEN },
    ply: { type: Number, default: 0 }, // optimistic-concurrency guard: equals moves.length
    moves: [moveSchema],
    pgn: String,

    status: { type: String, enum: GAME_STATUSES, default: "in_progress" },
    result: { type: String, enum: ["1-0", "0-1", "1/2-1/2", "*"], default: "*" },
    endReason: { type: String, enum: END_REASONS },
    completedAt: Date,

    rated: { type: Boolean, default: false },
    ratingChange: { white: Number, black: Number },
    timeControl: { initialMs: Number, incrementMs: Number },
    clocks: { whiteMs: Number, blackMs: Number, lastMoveAt: Date },
    paused: { type: Boolean, default: false },
    drawOfferBy: { type: String, enum: ["w", "b", null], default: null },
    roomCode: { type: String, index: { unique: true, sparse: true } },

    opening: { eco: String, name: String },
    analysisStatus: { type: String, enum: ["none", "pending", "running", "completed", "failed"], default: "none" },
    hintsUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

gameSessionSchema.index({ player: 1, createdAt: -1 });
gameSessionSchema.index({ whitePlayer: 1, createdAt: -1 });
gameSessionSchema.index({ blackPlayer: 1, createdAt: -1 });
gameSessionSchema.index({ status: 1, mode: 1 });

// Works whether player fields are ObjectIds or populated documents.
const idOf = (p) => (p && p._id ? String(p._id) : p ? String(p) : null);

// Which colour does this user play? null if not a participant.
gameSessionSchema.methods.colorOf = function (userId) {
  const id = String(userId);
  if (this.mode === "online") {
    if (idOf(this.whitePlayer) === id) return "w";
    if (idOf(this.blackPlayer) === id) return "b";
    return null;
  }
  return idOf(this.player) === id ? this.playerColor : null;
};

gameSessionSchema.methods.isParticipant = function (userId) {
  const id = String(userId);
  return [this.player, this.whitePlayer, this.blackPlayer].some((p) => idOf(p) === id);
};

gameSessionSchema.methods.isFinished = function () {
  return !["waiting", "in_progress"].includes(this.status);
};

// "win" | "loss" | "draw" | null (unfinished) for one user, including legacy docs.
gameSessionSchema.methods.outcomeFor = function (userId) {
  if (["won", "lost", "draw"].includes(this.status)) {
    // Legacy statuses were recorded from the creator's point of view.
    const map = { won: "win", lost: "loss", draw: "draw" };
    return idOf(this.player) === String(userId) ? map[this.status] : null;
  }
  if (!this.isFinished() || this.result === "*") return null;
  if (this.result === "1/2-1/2") return "draw";
  const color = this.mode === "local" ? null : this.colorOf(userId);
  if (!color) return null;
  return (this.result === "1-0") === (color === "w") ? "win" : "loss";
};

const GameSession = mongoose.model("GameSession", gameSessionSchema);
export default GameSession;
