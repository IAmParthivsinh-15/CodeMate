import express from "express";
import { protectRoutes } from "../../middleware/auth.js";
import gameAnalysisController from "./gameAnalysis.controller.js";

const router = express.Router();

router.post("/analyze", protectRoutes, gameAnalysisController.analyzeGame);

export default router;
