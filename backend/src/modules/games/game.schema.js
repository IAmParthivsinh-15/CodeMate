import { z } from "zod";
import { DIFFICULTIES } from "../../infrastructure/stockfish/chessEngine.js";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const square = z.string().regex(/^[a-h][1-8]$/);
export const moveInput = z.union([
  z.object({ from: square, to: square, promotion: z.enum(["q", "r", "b", "n"]).optional() }),
  z.object({ san: z.string().min(2).max(10) }),
  z.object({ uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/) }),
]);

export const timeControl = z.object({
  initialMs: z.number().int().min(30_000).max(3 * 3600_000),
  incrementMs: z.number().int().min(0).max(60_000).default(0),
});

export const createGameSchema = z.object({
  mode: z.enum(["ai", "local"]).default("ai"),
  color: z.enum(["white", "black", "random"]).default("white"),
  difficulty: z.enum(DIFFICULTIES).default("intermediate"),
  rated: z.boolean().optional(),
  timeControl: timeControl.optional(),
});

export const makeMoveSchema = z.object({
  move: moveInput,
  expectedPly: z.number().int().min(0).optional(),
});

export const listGamesQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  mode: z.enum(["ai", "local", "online"]).optional(),
  status: z.enum(["in_progress", "completed", "abandoned", "waiting"]).optional(),
});

export const idParams = z.object({ id: objectId });

// Legacy /api/game/* bodies
export const legacyStartSchema = z.object({
  opponent: z.enum(["computer", "human"]),
  difficulty: z.enum(DIFFICULTIES).optional(),
  color: z.enum(["white", "black", "random"]).optional(),
});
export const legacySaveSchema = z.object({
  gameId: objectId,
  move: z.union([z.string().min(2).max(10), moveInput]),
  fen: z.string().optional(), // ignored: the server computes the position
});
export const legacyEndSchema = z.object({
  gameId: objectId,
  status: z.enum(["won", "lost", "draw", "abandoned"]),
});
export const legacyBotMoveSchema = z.object({ gameId: objectId });
