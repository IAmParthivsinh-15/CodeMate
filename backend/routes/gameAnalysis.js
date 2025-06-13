import express from "express";
import { protectRoutes } from "../middlewares/auth.js";
import gameAnalysisController from "../controller/gameAnalysisController.js";

const router = express.Router();

router.post("/analyze", protectRoutes, gameAnalysisController.analyzeGame);

export default router;
