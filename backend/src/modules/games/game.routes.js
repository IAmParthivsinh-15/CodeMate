import express from "express";
import { protectRoutes } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as c from "./game.controller.js";
import * as s from "./game.schema.js";

// New API, mounted at /api/games (spec §41).
export const gamesRouter = express.Router();
gamesRouter.use(protectRoutes);
gamesRouter.post("/", validate({ body: s.createGameSchema }), c.createGame);
gamesRouter.get("/", validate({ query: s.listGamesQuery }), c.listGames);
gamesRouter.get("/:id", validate({ params: s.idParams }), c.getGame);
gamesRouter.get("/:id/pgn", validate({ params: s.idParams }), c.downloadPgn);
gamesRouter.post("/:id/moves", validate({ params: s.idParams, body: s.makeMoveSchema }), c.makeMove);
gamesRouter.post("/:id/bot-move", validate({ params: s.idParams }), c.botMove);
gamesRouter.post("/:id/resign", validate({ params: s.idParams }), c.resignGame);
gamesRouter.post("/:id/abort", validate({ params: s.idParams }), c.abortGame);
gamesRouter.post("/:id/draw", validate({ params: s.idParams }), c.drawGame);
gamesRouter.post("/:id/hint", validate({ params: s.idParams }), c.hint);

// Legacy API, mounted at /api/game. Deprecated: use /api/games.
const router = express.Router();
router.use(protectRoutes);
router.post("/start", validate({ body: s.legacyStartSchema }), c.legacyStart);
router.post("/save", validate({ body: s.legacySaveSchema }), c.legacySave);
router.post("/end", validate({ body: s.legacyEndSchema }), c.legacyEnd);
router.post("/bot-move", validate({ body: s.legacyBotMoveSchema }), c.legacyBotMove);

export default router;
