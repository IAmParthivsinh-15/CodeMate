import GameSession from "./gameSession.model.js";
import User from "../users/user.model.js";
import * as games from "./game.service.js";
import { ok, created, parsePagination, paginated } from "../../shared/http.js";
import { conflict } from "../../shared/errors.js";
import { opponentView } from "../users/users.service.js";

// Client-facing representation of a game.
export async function gameView(game, userId) {
  const chess = games.replay(game);
  const ids = [game.whitePlayer, game.blackPlayer, game.player].filter(Boolean);
  const users = await User.find({ _id: { $in: ids } }).select("username chessStats.rating").lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const side = (color) => {
    if (game.mode === "ai") {
      return color === game.playerColor
        ? { type: "human", ...opponentView(byId.get(String(game.player))) }
        : { type: "engine", username: `Stockfish (${game.difficulty})` };
    }
    if (game.mode === "local") return { type: "human", username: color === "w" ? "White" : "Black" };
    const id = color === "w" ? game.whitePlayer : game.blackPlayer;
    return id ? { type: "human", ...opponentView(byId.get(String(id))) } : { type: "open" };
  };
  return {
    _id: game._id,
    mode: game.mode,
    status: game.status,
    result: game.result,
    endReason: game.endReason || null,
    difficulty: game.mode === "ai" ? game.difficulty : null,
    yourColor: game.mode === "local" ? null : game.colorOf(userId),
    white: side("w"),
    black: side("b"),
    initialFen: game.initialFen,
    fen: chess.fen(),
    currentFEN: chess.fen(), // legacy name
    turn: chess.turn(),
    ply: game.ply,
    moves: game.moves.map((m) => ({ ply: m.ply, san: m.san || m.move, uci: m.uci, color: m.color, fen: m.fen, clockMs: m.clockMs })),
    pgn: game.pgn || null,
    opening: game.opening?.name ? game.opening : null,
    rated: game.rated,
    ratingChange: game.ratingChange?.white != null || game.ratingChange?.black != null ? game.ratingChange : null,
    timeControl: game.timeControl?.initialMs ? game.timeControl : null,
    clocks: game.clocks?.whiteMs != null ? games.currentClocks(game, chess.turn()) : null,
    paused: !!game.paused,
    drawOfferBy: game.drawOfferBy || null,
    roomCode: game.status === "waiting" ? game.roomCode : undefined,
    analysisStatus: game.analysisStatus,
    hintsUsed: game.hintsUsed || 0,
    createdAt: game.createdAt,
    completedAt: game.completedAt || null,
  };
}

const participantFilter = (userId) => ({ $or: [{ player: userId }, { whitePlayer: userId }, { blackPlayer: userId }] });

// ------------------------------------------------------------ /api/games ----

export const createGame = async (req, res) => {
  const game = await games.createGame(req.user, req.body);
  created(res, { game: await gameView(game, req.user._id) });
};

export const listGames = async (req, res) => {
  const q = req.validatedQuery || {};
  const page = parsePagination(q);
  const filter = { ...participantFilter(req.user._id) };
  if (q.mode) filter.mode = q.mode;
  if (q.status === "completed") filter.status = { $in: ["completed", "won", "lost", "draw"] };
  else if (q.status) filter.status = q.status;
  const [items, total] = await Promise.all([
    GameSession.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit)
      .select("-moves.fen -moves.clientMoveId").populate("whitePlayer blackPlayer player", "username chessStats.rating"),
    GameSession.countDocuments(filter),
  ]);
  const summaries = items.map((g) => ({
    _id: g._id,
    mode: g.mode,
    status: g.status,
    result: g.result,
    endReason: g.endReason || null,
    difficulty: g.mode === "ai" ? g.difficulty : null,
    yourColor: g.mode === "local" ? null : g.colorOf(req.user._id),
    outcome: g.outcomeFor(req.user._id),
    opponent: g.mode === "ai" ? `Stockfish (${g.difficulty})`
      : g.mode === "local" ? "Local game"
        : [g.whitePlayer, g.blackPlayer].find((p) => p && String(p._id) !== String(req.user._id))?.username || "Waiting…",
    plies: g.ply || g.moves.length,
    opening: g.opening?.name || null,
    rated: g.rated,
    ratingChange: g.ratingChange,
    analysisStatus: g.analysisStatus,
    createdAt: g.createdAt,
    completedAt: g.completedAt,
  }));
  ok(res, paginated(summaries, total, page));
};

export const getGame = async (req, res) => {
  const game = await games.loadGameFor(req.params.id, req.user._id);
  ok(res, { game: await gameView(game, req.user._id) });
};

export const makeMove = async (req, res) => {
  const game = await games.loadGameFor(req.params.id, req.user._id);
  const result = await games.moveAndReply(game, req.user._id, req.body.move, { expectedPly: req.body.expectedPly });
  ok(res, { move: result.move, reply: result.reply, outcome: result.outcome, game: await gameView(result.game, req.user._id) });
};

export const botMove = async (req, res) => {
  const game = await games.loadGameFor(req.params.id, req.user._id);
  const result = await games.playBotMove(game);
  ok(res, { move: result.move, outcome: result.outcome, game: await gameView(result.game, req.user._id) });
};

export const resignGame = async (req, res) => {
  const game = await games.loadGameFor(req.params.id, req.user._id);
  ok(res, { game: await gameView(await games.resign(game, req.user._id), req.user._id) });
};

export const abortGame = async (req, res) => {
  const game = await games.loadGameFor(req.params.id, req.user._id);
  ok(res, { game: await gameView(await games.abort(game), req.user._id) });
};

// Draws by agreement over REST exist only for local games (the engine never
// accepts; online draws go through draw:offer / draw:accept on the socket).
export const drawGame = async (req, res) => {
  const game = await games.loadGameFor(req.params.id, req.user._id);
  if (game.mode !== "local") throw conflict("Draw offers here are only for local games", "DRAW_NOT_ALLOWED");
  ok(res, { game: await gameView(await games.agreeDraw(game), req.user._id) });
};

export const hint = async (req, res) => {
  const game = await games.loadGameFor(req.params.id, req.user._id);
  ok(res, await games.useHint(game, req.user._id));
};

export const downloadPgn = async (req, res) => {
  const game = await games.loadGameFor(req.params.id, req.user._id);
  const pgn = game.pgn || (await games.buildPgn(game));
  res.type("application/x-chess-pgn").attachment(`codemate-${game._id}.pgn`).send(pgn);
};

// ------------------------------------------------------ legacy /api/game ----
// Same URLs and response fields as before Phase 0, now server-validated.

export const legacyStart = async (req, res) => {
  const { opponent, difficulty, color } = req.body;
  const game = await games.createGame(req.user, {
    mode: opponent === "computer" ? "ai" : "local",
    difficulty: difficulty || "intermediate",
    color: color || "white",
  });
  created(res, { message: "Game started successfully", gameId: game._id, currentFEN: game.currentFEN, game: await gameView(game, req.user._id) });
};

export const legacySave = async (req, res) => {
  const game = await games.loadGameFor(req.body.gameId, req.user._id);
  const { game: updated } = await games.applyMove(game, { userId: req.user._id, input: req.body.move });
  ok(res, { message: "Game saved successfully", gameId: updated._id, currentFEN: updated.currentFEN, moves: updated.moves, status: updated.status, result: updated.result });
};

// Old clients reported the result themselves. Now: "lost" = resign,
// "abandoned" = abort (or resign once moves exist); "won"/"draw" are only
// accepted when the board already shows that result.
export const legacyEnd = async (req, res) => {
  let game = await games.loadGameFor(req.body.gameId, req.user._id);
  const { status } = req.body;
  if (!game.isFinished()) {
    if (status === "lost") game = await games.resign(game, req.user._id);
    else if (status === "abandoned") game = game.ply < 2 ? await games.abort(game) : await games.resign(game, req.user._id);
    else {
      const outcome = games.detectOutcome(games.replay(game));
      if (!outcome) throw conflict("The game is not over on the board", "GAME_NOT_OVER");
      game = await games.finishGame(game._id, outcome);
    }
  }
  const outcome = game.outcomeFor(req.user._id);
  ok(res, {
    message: "Game ended successfully",
    gameId: game._id,
    status: outcome === "win" ? "won" : outcome === "loss" ? "lost" : outcome === "draw" ? "draw" : game.status,
    result: game.result,
    currentFEN: game.currentFEN,
    moves: game.moves,
  });
};

export const legacyBotMove = async (req, res) => {
  const game = await games.loadGameFor(req.body.gameId, req.user._id);
  const { game: updated, move } = await games.playBotMove(game);
  ok(res, { message: "Best move retrieved successfully", bestMove: move.uci, san: move.san, currentFEN: updated.currentFEN, moves: updated.moves });
};
