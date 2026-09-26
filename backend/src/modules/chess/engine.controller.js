import { z } from "zod";
import { enginePool, DIFFICULTY, DIFFICULTIES } from "../../infrastructure/stockfish/chessEngine.js";
import { badRequest } from "../../shared/errors.js";

// Debug endpoint (ENABLE_DEBUG_ROUTES=true only): best move for a FEN.
const schema = z.object({ fen: z.string().min(10).max(120), level: z.enum(DIFFICULTIES).default("grandmaster") });

export async function getBestMoveHandler(req, res) {
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) throw badRequest("A valid FEN string is required", parsed.error.issues);
  const cfg = DIFFICULTY[parsed.data.level];
  const result = await enginePool().search({ fen: parsed.data.fen, depth: cfg.depth, skill: cfg.skill });
  res.status(200).json({ bestMove: result.bestMove, score: result.score, pv: result.pv });
}
