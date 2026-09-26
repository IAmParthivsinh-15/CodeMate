import express from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import gameRoutes from "../modules/games/game.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";
import codeRoutes from "../modules/coding/codeExecution.routes.js";
import queRoutes from "../modules/coding/codingQuestion.routes.js";
import gameAnalysisRoutes from "../modules/analysis/gameAnalysis.routes.js";
import { getBestMoveHandler } from "../modules/chess/engine.controller.js";

// Every module router is mounted here. URL prefixes are kept exactly as they
// were before the modular restructure so existing clients keep working.
const router = express.Router();

router.use("/api/auth", authRoutes);
router.use("/api/game", gameRoutes);
router.use("/api/admin", adminRoutes);
router.use("/api/code", codeRoutes);
router.use("/api/coding-questions", queRoutes);
router.use("/api/game-analysis", gameAnalysisRoutes);
router.get("/test", getBestMoveHandler);

router.get("/", (req, res) => {
  res.send("Welcome to the Chess Game API");
});

export default router;
