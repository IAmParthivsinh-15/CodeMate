import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
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
  },
  {
    timestamps: true,
    versionKey: false,
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
