import mongoose from "mongoose";

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
      minlength: 6,
    },
    chessStats: {
      gamesPlayed: { type: Number, default: 0 },
      rating: { type: Number, default: 800 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
    },
    codingStats: {
      problemsSolved: { type: Number, default: 0 },
      preferredLanguage: { type: String, default: "javascript" },
    },
    refreshTokens: [
      {
        token: String,
        expires: Date,
      },
    ],
    submissions: [submissionSchema]
  },
  {
    timestamps: true
  }
);

userSchema.methods = {
  addRefreshToken: async function (token, expires) {
    try {
      this.refreshTokens.push({ token, expires });
      const savedUser = await this.save();
      return savedUser;
    } catch (error) {
      console.error("Error adding refresh token:", error);
      throw error;
    }
  },

  removeRefreshToken: function (token) {
    this.refreshTokens = this.refreshTokens.filter((t) => t.token !== token);
    return this.save();
  },
};

const User = mongoose.model("User", userSchema);
export default User;
