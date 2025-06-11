import express from "express";
import { protectRoutes } from "../middlewares/auth.js";
import { startGame, endGame, saveGame } from "../controller/game.js";

const router = express.Router();

router.post("/start", protectRoutes, startGame);
router.post("/end", protectRoutes, endGame);
router.post("/save", protectRoutes, saveGame);

export default router;
