import express from "express";
import mongoose from "mongoose";
import authRoutes from "../modules/auth/auth.routes.js";
import usersRoutes from "../modules/users/users.routes.js";
import gameRoutes, { gamesRouter } from "../modules/games/game.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";
import codeRoutes from "../modules/coding/codeExecution.routes.js";
import codingRoutes from "../modules/coding/coding.routes.js";
import queRoutes from "../modules/coding/codingQuestion.routes.js";
import gameAnalysisRoutes, { analysisRouter } from "../modules/analysis/gameAnalysis.routes.js";
import { puzzlesRouter, practiceRouter } from "../modules/learning/learning.routes.js";
import { gameAiRouter, chessAiRouter, coachRouter, aiStatusHandler } from "../modules/ai/ai.routes.js";
import { dashboardRouter, leaderboardRouter } from "../modules/analytics/analytics.routes.js";
import { getBestMoveHandler } from "../modules/chess/engine.controller.js";
import { protectRoutes } from "../middleware/auth.js";
import { TIME_CONTROLS } from "../modules/games/online.service.js";
import { DIFFICULTY } from "../infrastructure/stockfish/chessEngine.js";
import { kv } from "../infrastructure/redis/index.js";
import { getBus } from "../infrastructure/kafka/index.js";
import { vectorStore } from "../infrastructure/vector/index.js";
import { llm } from "../infrastructure/llm/index.js";
import { registry, metrics } from "../infrastructure/metrics/index.js";
import { env } from "../config/env.js";

const router = express.Router();

// ---- operations ----
router.get("/health", (req, res) => res.json({ status: "ok", role: env.SERVICE_ROLE, uptime: Math.round(process.uptime()) }));
router.get("/ready", async (req, res) => {
  const checks = { mongo: mongoose.connection.readyState === 1 };
  try {
    const t = metrics.redisLatency.startTimer();
    checks.kv = (await kv().ping()) === "PONG";
    t();
  } catch {
    checks.kv = false;
  }
  const ready = Object.values(checks).every(Boolean);
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    checks,
    backends: { kv: kv().kind, events: getBus().kind, vector: vectorStore().kind, llm: llm.providerName },
  });
});
if (env.METRICS_ENABLED) {
  router.get("/metrics", async (req, res) => res.type(registry.contentType).send(await registry.metrics()));
}

// ---- current API (spec §41) ----
router.use("/api/auth", authRoutes);
router.use("/api/users", usersRoutes);
router.use("/api/games", gamesRouter, analysisRouter, gameAiRouter, practiceRouter);
router.use("/api/puzzles", puzzlesRouter);
router.use("/api/chess", chessAiRouter);
router.use("/api/coach", coachRouter);
router.use("/api/coding", codingRoutes);
router.use("/api/dashboard", dashboardRouter);
router.use("/api/leaderboard", leaderboardRouter);
router.get("/api/ai/status", protectRoutes, aiStatusHandler);
router.get("/api/meta", (req, res) =>
  res.json({
    success: true,
    difficulties: Object.entries(DIFFICULTY).map(([key, d]) => ({ key, elo: d.elo })),
    timeControls: Object.entries(TIME_CONTROLS).map(([key, t]) => ({ key, ...t })),
  })
);

// ---- admin ----
router.use("/api/admin", adminRoutes);
router.use("/api/coding-questions", queRoutes);

// ---- legacy (pre-Phase-0 paths, kept working; see docs/api/api.md) ----
router.use("/api/game", gameRoutes);
router.use("/api/game-analysis", gameAnalysisRoutes);
router.use("/api/code", codeRoutes);

// Debug engine endpoint: development only (it was public and unauthenticated).
if (env.ENABLE_DEBUG_ROUTES) router.post("/test", getBestMoveHandler);

router.get("/", (req, res) => res.send("Welcome to the Chess Game API"));

export default router;
