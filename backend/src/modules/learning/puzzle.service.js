import { Chess } from "chess.js";
import Puzzle from "./puzzle.model.js";
import GameAnalysis from "../analysis/gameAnalysis.model.js";
import GameSession from "../games/gameSession.model.js";
import { userColors } from "../analysis/analysis.service.js";
import { enginePool } from "../../infrastructure/stockfish/chessEngine.js";
import { scoreToCp, toWhitePov } from "../../infrastructure/stockfish/uci.js";
import { badRequest, conflict, notFound } from "../../shared/errors.js";

// Only positions where finding the best move actually mattered, and where the
// player wasn't already completely lost or completely winning.
const ELIGIBLE = new Set(["mistake", "blunder"]);
const DECIDED_CP = 600;
// An alternative answer is accepted if it keeps the evaluation within this many
// centipawns of the expected move.
export const ACCEPT_WINDOW_CP = 30;

const difficultyFor = (cpl) => (cpl >= 400 ? "easy" : cpl >= 200 ? "medium" : "hard"); // big swings are easier to see

const buildPuzzle = (game, userId, m) => ({
  user: userId,
  sourceGame: game._id,
  sourcePly: m.ply,
  sourceMoveNumber: m.moveNumber,
  fen: m.fenBefore,
  sideToMove: m.color,
  expectedMove: m.bestMoveUci,
  expectedSan: m.bestMove,
  playedMove: m.playedMove,
  evaluationBest: m.evaluationBefore,
  centipawnLoss: m.centipawnLoss,
  theme: m.themes?.[0] || m.phase,
  themes: m.themes,
  difficulty: difficultyFor(m.centipawnLoss),
});

// Auto-generation filter: skip positions already lost, or still clearly won
// after the mistake (finding the best move there teaches little).
function isPuzzleWorthy(m) {
  if (!ELIGIBLE.has(m.classification) || !m.bestMoveUci) return false;
  const sign = m.color === "w" ? 1 : -1;
  return sign * m.evaluationBefore >= -DECIDED_CP && sign * m.evaluationAfter <= DECIDED_CP;
}

// Called by the analysis worker once a game's analysis is complete.
export async function generatePuzzlesForGame(gameId) {
  const [game, analysis] = await Promise.all([GameSession.findById(gameId), GameAnalysis.findOne({ gameSession: gameId }).lean()]);
  if (!game || analysis?.status !== "completed") return 0;
  const colors = userColors(game);
  let created = 0;
  for (const m of analysis.moveAnalysis) {
    if (!colors.includes(m.color)) continue;
    const owner = game.mode === "online" ? (m.color === "w" ? game.whitePlayer : game.blackPlayer) : game.player;
    if (!owner || !isPuzzleWorthy(m)) continue;
    const doc = buildPuzzle(game, owner, m);
    const r = await Puzzle.updateOne({ user: owner, sourceGame: game._id, sourcePly: m.ply }, { $setOnInsert: doc }, { upsert: true });
    created += r.upsertedCount || 0;
  }
  return created;
}

// "Practice this mistake" from the analysis page (spec §16): works for any
// analysed move of the user's, including inaccuracies.
export async function puzzleForMove(game, userId, ply) {
  const analysis = await GameAnalysis.findOne({ gameSession: game._id }).lean();
  if (analysis?.status !== "completed") throw conflict("Analyze the game first", "NOT_ANALYZED");
  const m = analysis.moveAnalysis.find((x) => x.ply === ply);
  if (!m) throw notFound("Move");
  if (game.mode !== "local" && game.colorOf(userId) !== m.color) throw badRequest("That was your opponent's move", undefined, "NOT_YOUR_MOVE");
  if (!m.bestMoveUci || m.bestMoveUci === m.playedMoveUci) throw badRequest("You played the best move here", undefined, "ALREADY_BEST");
  const doc = buildPuzzle(game, userId, m);
  await Puzzle.updateOne({ user: userId, sourceGame: game._id, sourcePly: ply }, { $setOnInsert: doc }, { upsert: true });
  return Puzzle.findOne({ user: userId, sourceGame: game._id, sourcePly: ply });
}

export const puzzleView = (p, { reveal = false } = {}) => ({
  _id: p._id,
  fen: p.fen,
  sideToMove: p.sideToMove,
  theme: p.theme,
  themes: p.themes,
  difficulty: p.difficulty,
  sourceGame: p.sourceGame,
  sourceMoveNumber: p.sourceMoveNumber,
  playedMove: p.playedMove,
  attempts: p.attempts,
  solved: !!p.solvedAt,
  ...(reveal || p.solvedAt ? { expectedSan: p.expectedSan, expectedMove: p.expectedMove } : {}),
});

/**
 * Check an answer. The expected move is always accepted; another move is
 * accepted if Stockfish rates it within ACCEPT_WINDOW_CP of the expected one.
 */
export async function attemptPuzzle(puzzle, moveInput) {
  const chess = new Chess(puzzle.fen);
  let mv;
  try {
    mv = chess.move(moveInput);
  } catch {
    throw badRequest("Illegal move", undefined, "ILLEGAL_MOVE");
  }
  let correct = mv.lan === puzzle.expectedMove;
  let evaluation = null;
  if (!correct) {
    if (chess.isCheckmate()) correct = true;
    else {
      const res = await enginePool().search({ fen: chess.fen(), depth: 14 });
      const cp = res.score ? scoreToCp(toWhitePov(res.score, chess.turn())) : 0;
      evaluation = cp;
      const sign = puzzle.sideToMove === "w" ? 1 : -1;
      correct = sign * cp >= sign * puzzle.evaluationBest - ACCEPT_WINDOW_CP;
    }
  }
  const update = { $inc: { attempts: 1 }, $set: { lastAttemptAt: new Date() } };
  if (correct && !puzzle.solvedAt) update.$set.solvedAt = new Date();
  const updated = await Puzzle.findByIdAndUpdate(puzzle._id, update, { new: true });
  return {
    correct,
    played: { san: mv.san, uci: mv.lan },
    expected: correct || updated.attempts >= 3 ? { san: puzzle.expectedSan, uci: puzzle.expectedMove } : null,
    evaluation,
    attempts: updated.attempts,
    puzzle: puzzleView(updated),
  };
}
