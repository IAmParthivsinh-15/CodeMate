import express from "express";
import { z } from "zod";
import User from "./user.model.js";
import RatingHistory from "../ratings/ratingHistory.model.js";
import { protectRoutes } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../shared/http.js";
import { notFound } from "../../shared/errors.js";
import { publicUser, opponentView } from "./users.service.js";
import { DIFFICULTIES } from "../../infrastructure/stockfish/chessEngine.js";
import { getUserStatistics } from "../analytics/analytics.service.js";

const router = express.Router();

const updateSchema = z
  .object({
    username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
    preferences: z
      .object({
        boardTheme: z.enum(["classic", "green", "blue", "wood"]).optional(),
        pieceSet: z.string().max(30).optional(),
        defaultDifficulty: z.enum(DIFFICULTIES).optional(),
        showEvaluation: z.boolean().optional(),
      })
      .strict()
      .optional(),
    preferredLanguage: z.enum(["javascript", "python", "java", "cpp"]).optional(),
  })
  .strict();

router.get("/me", protectRoutes, (req, res) => ok(res, { user: publicUser(req.user) }));

router.patch("/me", protectRoutes, validate({ body: updateSchema }), async (req, res) => {
  const { username, preferences, preferredLanguage } = req.body;
  const set = {};
  if (username) set.username = username;
  if (preferredLanguage) set["codingStats.preferredLanguage"] = preferredLanguage;
  for (const [k, v] of Object.entries(preferences || {})) set[`preferences.${k}`] = v;
  const user = await User.findByIdAndUpdate(req.user._id, { $set: set }, { new: true, runValidators: true });
  ok(res, { user: publicUser(user) });
});

router.get("/me/statistics", protectRoutes, async (req, res) => ok(res, await getUserStatistics(req.user._id)));

router.get("/me/rating-history", protectRoutes, async (req, res) => {
  const history = await RatingHistory.find({ user: req.user._id }).sort({ createdAt: 1 }).limit(500).lean();
  ok(res, { current: req.user.chessStats?.rating ?? 800, history });
});

router.get("/:id", protectRoutes, async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) throw notFound("User");
  ok(res, { user: { ...opponentView(user), chessStats: user.chessStats, codingStats: { problemsSolved: user.codingStats?.problemsSolved ?? 0 } } });
});

export default router;
