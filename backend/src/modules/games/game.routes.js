import express from "express";
import { protectRoutes } from "../../middleware/auth.js";
import { startGame, endGame, saveGame } from "./game.controller.js";

const router = express.Router();

router.post("/start", protectRoutes, startGame);
router.post("/end", protectRoutes, endGame);
router.post("/save", protectRoutes, saveGame);

export default router;
