import mongoose from "mongoose";

const ratingHistorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    game: { type: mongoose.Schema.Types.ObjectId, ref: "GameSession", required: true },
    before: Number,
    after: Number,
    delta: Number,
    opponentRating: Number,
    score: Number, // 1 win, 0.5 draw, 0 loss
  },
  { timestamps: true }
);

ratingHistorySchema.index({ user: 1, game: 1 }, { unique: true }); // one change per game: idempotent
ratingHistorySchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("RatingHistory", ratingHistorySchema);
