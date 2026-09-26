import express from "express";
import { protectRoutes } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { limiters } from "../../middleware/rateLimit.js";
import { loadGameFor } from "../games/game.service.js";
import { analyzeGame, requestAnalysis } from "./analysis.service.js";
import GameAnalysis from "./gameAnalysis.model.js";
import { idParams, legacyBotMoveSchema as gameIdBody } from "../games/game.schema.js";
import { ok } from "../../shared/http.js";
import { conflict } from "../../shared/errors.js";

// New API, mounted at /api/games alongside the games router.
export const analysisRouter = express.Router();
analysisRouter.use(protectRoutes);

analysisRouter.get("/:id/analysis", validate({ params: idParams }), async (req, res) => {
  const game = await loadGameFor(req.params.id, req.user._id);
  const analysis = await GameAnalysis.findOne({ gameSession: game._id }).lean();
  ok(res, {
    status: analysis?.status || game.analysisStatus || "none",
    aiStatus: analysis?.aiStatus || "none",
    analysis: analysis?.status === "completed" ? analysis : null,
  });
});

// Asynchronous (spec §28): returns 202 and the analysis worker picks it up.
analysisRouter.post("/:id/analyze", limiters.analysis, validate({ params: idParams }), async (req, res) => {
  const game = await loadGameFor(req.params.id, req.user._id);
  const { status } = await requestAnalysis(game, req.user._id);
  if (status === "not_finished") throw conflict("Finish the game before analyzing it", "GAME_NOT_FINISHED");
  if (status === "no_moves") throw conflict("This game has no moves to analyze", "NO_MOVES");
  res.status(status === "completed" ? 200 : 202).json({ success: true, status });
});

// Legacy API, mounted at /api/game-analysis. Synchronous, as before.
const router = express.Router();
router.use(protectRoutes);

router.post("/analyze", limiters.analysis, validate({ body: gameIdBody }), async (req, res) => {
  const game = await loadGameFor(req.body.gameId, req.user._id);
  if (!game.moves.length) throw conflict("This game has no moves to analyze", "NO_MOVES");
  const analysis = await analyzeGame(game._id);
  res.json(analysis);
});

router.get("/:id", validate({ params: idParams }), async (req, res) => {
  const game = await loadGameFor(req.params.id, req.user._id);
  const analysis = await GameAnalysis.findOne({ gameSession: game._id });
  if (!analysis) return res.status(404).json({ success: false, error: { code: "ANALYSIS_NOT_FOUND", message: "Analysis not found" }, message: "Analysis not found" });
  res.json(analysis);
});

export default router;
