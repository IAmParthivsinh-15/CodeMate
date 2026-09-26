import mongoose from "mongoose";
import { createHash } from "crypto";

const submissionSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CodingQuestion',
    required: true
  },
  code: {
    type: String,
    required: true
  },
  language: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  samples: [{
    input: String,
    output: String,
    expected: String,
    status: String,
    time: String,
    memory: Number,
    error: String,
    passed: Boolean
  }],
  testCases: [{
    input: String,
    output: String,
    expected: String,
    status: String,
    time: String,
    memory: Number,
    error: String,
    passed: Boolean
  }],
  executedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const userSchema = new mongoose.Schema({
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // must be requested explicitly with .select("+password")
    },
    chessStats: {
      gamesPlayed: { type: Number, default: 0 },
      rating: { type: Number, default: 800 },
      peakRating: { type: Number, default: 800 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
    },
    codingStats: {
      problemsSolved: { type: Number, default: 0 },
      submissions: { type: Number, default: 0 },
      accepted: { type: Number, default: 0 },
      preferredLanguage: { type: String, default: "javascript" },
    },
    // Earned by solving coding problems; spent on engine hints during AI games.
    hintCredits: { type: Number, default: 0, min: 0 },
    preferences: {
      boardTheme: { type: String, default: "classic" },
      pieceSet: { type: String, default: "default" },
      defaultDifficulty: { type: String, default: "intermediate" },
      showEvaluation: { type: Boolean, default: true },
    },
    refreshTokens: [
      {
        token: String,
        expires: Date,
      },
    ],
    submissions: [submissionSchema], // legacy: new submissions live in the submissions collection
  },
  {
    timestamps: true
  }
);

// Refresh tokens are stored as SHA-256 hashes, so a database leak doesn't
// hand out live sessions. Expired entries are pruned on every write.
const MAX_SESSIONS = 10;
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");

userSchema.methods = {
  addRefreshToken: async function (token, expires) {
    const now = Date.now();
    this.refreshTokens = this.refreshTokens
      .filter((t) => t.expires && t.expires.getTime() > now)
      .slice(-(MAX_SESSIONS - 1));
    this.refreshTokens.push({ token: hashToken(token), expires });
    return this.save();
  },

  hasRefreshToken: function (token) {
    const hashed = hashToken(token);
    // Plain-text match keeps sessions created before hashing was introduced valid.
    return this.refreshTokens.some((t) => (t.token === hashed || t.token === token) && (!t.expires || t.expires > new Date()));
  },

  removeRefreshToken: function (token) {
    const hashed = hashToken(token);
    this.refreshTokens = this.refreshTokens.filter((t) => t.token !== hashed && t.token !== token);
    return this.save();
  },
};

const User = mongoose.model("User", userSchema);
export default User;
