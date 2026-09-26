import express from "express";
import { z } from "zod";
import Puzzle from "./puzzle.model.js";
import { protectRoutes } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { loadGameFor } from "../games/game.service.js";
import { puzzleForMove, puzzleView, attemptPuzzle } from "./puzzle.service.js";
import { objectId, moveInput } from "../games/game.schema.js";
import { ok, created, parsePagination, paginated } from "../../shared/http.js";
import { notFound } from "../../shared/errors.js";

const idParams = z.object({ id: objectId });
const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  solved: z.enum(["true", "false"]).optional(),
  theme: z.string().max(40).optional(),
});

const own = async (id, userId) => {
  const p = await Puzzle.findOne({ _id: id, user: userId });
  if (!p) throw notFound("Puzzle");
  return p;
};

// /api/puzzles
export const puzzlesRouter = express.Router();
puzzlesRouter.use(protectRoutes);

puzzlesRouter.get("/", validate({ query: listQuery }), async (req, res) => {
  const q = req.validatedQuery;
  const page = parsePagination(q);
  const filter = { user: req.user._id };
  if (q.solved === "true") filter.solvedAt = { $ne: null };
  if (q.solved === "false") filter.solvedAt = null;
  if (q.theme) filter.themes = q.theme;
  const [items, total] = await Promise.all([
    Puzzle.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit),
    Puzzle.countDocuments(filter),
  ]);
  ok(res, paginated(items.map((p) => puzzleView(p)), total, page));
});

// Next unsolved puzzle, optionally for one theme (used by coach recommendations).
puzzlesRouter.get("/next", validate({ query: listQuery }), async (req, res) => {
  const filter = { user: req.user._id, solvedAt: null };
  if (req.validatedQuery.theme) filter.themes = req.validatedQuery.theme;
  const p = await Puzzle.findOne(filter).sort({ attempts: 1, createdAt: 1 });
  ok(res, { puzzle: p ? puzzleView(p) : null });
});

puzzlesRouter.get("/:id", validate({ params: idParams }), async (req, res) => {
  ok(res, { puzzle: puzzleView(await own(req.params.id, req.user._id)) });
});

puzzlesRouter.post("/:id/attempt", validate({ params: idParams, body: z.object({ move: moveInput }) }), async (req, res) => {
  const p = await own(req.params.id, req.user._id);
  const input = req.body.move.san || req.body.move.uci || req.body.move;
  ok(res, await attemptPuzzle(p, input));
});

puzzlesRouter.post("/:id/reveal", validate({ params: idParams }), async (req, res) => {
  ok(res, { puzzle: puzzleView(await own(req.params.id, req.user._id), { reveal: true }) });
});

// /api/games/:id/mistakes/:ply/practice (spec §41)
export const practiceRouter = express.Router();
practiceRouter.post(
  "/:id/mistakes/:ply/practice",
  protectRoutes,
  validate({ params: z.object({ id: objectId, ply: z.coerce.number().int().min(1) }) }),
  async (req, res) => {
    const game = await loadGameFor(req.params.id, req.user._id);
    const puzzle = await puzzleForMove(game, req.user._id, req.params.ply);
    created(res, { puzzle: puzzleView(puzzle) });
  }
);
