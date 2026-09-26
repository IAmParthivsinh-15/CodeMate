import { Chess } from "chess.js";
import GameSession, { START_FEN } from "./gameSession.model.js";
import User from "../users/user.model.js";
import RatingHistory from "../ratings/ratingHistory.model.js";
import { ratingDelta, applyDelta } from "../ratings/elo.js";
import { classifyOpening } from "../chess/openings.js";
import { DIFFICULTY, getBotMove, enginePool } from "../../infrastructure/stockfish/chessEngine.js";
import { kv, kvJson } from "../../infrastructure/redis/index.js";
import { publish } from "../../infrastructure/kafka/index.js";
import { TOPICS } from "../../shared/events.js";
import { badRequest, conflict, forbidden, notFound } from "../../shared/errors.js";
import { childLogger } from "../../infrastructure/logger/index.js";
import { metrics } from "../../infrastructure/metrics/index.js";

const log = childLogger("games");

// The server is authoritative (spec §10): the client proposes a move, the
// server replays the stored game with chess.js, validates turn and legality,
// and computes the new position and any result. Nothing about the position or
// result is ever read from the client.

export const LIVE_STATE_TTL_SEC = 6 * 3600;
export const DEADLINES_KEY = "clock:deadlines";
const stateKey = (gameId) => `game:${gameId}:state`;

// ---------------------------------------------------------------- helpers ---

export function replay(game) {
  const chess = new Chess(game.initialFen || START_FEN);
  for (const m of game.moves) {
    const notation = m.san || m.move;
    try {
      chess.move(notation);
    } catch {
      // Legacy documents may hold notation chess.js can't replay; fall back to
      // the stored position so the game stays usable (history is then partial).
      log.warn({ gameId: String(game._id), notation }, "Could not replay stored move");
      return new Chess(game.currentFEN || START_FEN);
    }
  }
  return chess;
}

// Accepts {from,to,promotion}, SAN ("Nf3") or UCI ("e7e8q").
export function normalizeMoveInput(input) {
  if (!input) throw badRequest("A move is required", undefined, "MOVE_REQUIRED");
  if (typeof input === "string") return input.trim();
  if (input.from && input.to) return { from: input.from, to: input.to, promotion: input.promotion || "q" };
  if (input.san) return input.san;
  if (input.uci) return input.uci;
  throw badRequest("Unrecognised move format", undefined, "INVALID_MOVE_FORMAT");
}

export function detectOutcome(chess) {
  if (chess.isCheckmate()) return { result: chess.turn() === "w" ? "0-1" : "1-0", reason: "checkmate" };
  if (chess.isStalemate()) return { result: "1/2-1/2", reason: "stalemate" };
  if (chess.isInsufficientMaterial()) return { result: "1/2-1/2", reason: "insufficient_material" };
  if (chess.isThreefoldRepetition()) return { result: "1/2-1/2", reason: "threefold_repetition" };
  if (chess.isDrawByFiftyMoves()) return { result: "1/2-1/2", reason: "fifty_move_rule" };
  return null;
}

const userName = async (id) => (id ? (await User.findById(id).select("username").lean())?.username : null);

export async function buildPgn(game, chess = replay(game)) {
  const whiteName = game.mode === "ai"
    ? game.playerColor === "w" ? await userName(game.player) : `Stockfish (${game.difficulty})`
    : (await userName(game.whitePlayer || game.player)) || "White";
  const blackName = game.mode === "ai"
    ? game.playerColor === "b" ? await userName(game.player) : `Stockfish (${game.difficulty})`
    : (await userName(game.blackPlayer || (game.mode === "local" ? game.player : null))) || "Black";
  chess.setHeader("Event", `CodeMate ${game.mode} game`);
  chess.setHeader("Site", "CodeMate");
  chess.setHeader("Date", (game.createdAt || new Date()).toISOString().slice(0, 10).replace(/-/g, "."));
  chess.setHeader("White", whiteName);
  chess.setHeader("Black", blackName);
  chess.setHeader("Result", game.result || "*");
  if (game.opening?.name) chess.setHeader("Opening", game.opening.name);
  if (game.initialFen && game.initialFen !== START_FEN) {
    chess.setHeader("SetUp", "1");
    chess.setHeader("FEN", game.initialFen);
  }
  return chess.pgn();
}

// Which user may move for `color` in this game?
function moverAllowed(game, userId, color) {
  if (!game.isParticipant(userId)) return false;
  if (game.mode === "local") return String(game.player) === String(userId);
  if (game.mode === "ai") return String(game.player) === String(userId) && game.playerColor === color;
  return game.colorOf(userId) === color;
}

export const isBotTurn = (game, chess = replay(game)) =>
  game.mode === "ai" && game.status === "in_progress" && chess.turn() !== game.playerColor;

// ---------------------------------------------------------------- live state -

export function liveState(game, chess = replay(game)) {
  return {
    gameId: String(game._id),
    mode: game.mode,
    status: game.status,
    result: game.result,
    endReason: game.endReason || null,
    fen: chess.fen(),
    turn: chess.turn(),
    ply: game.ply,
    inCheck: chess.inCheck(),
    lastMove: game.moves.at(-1) ? { san: game.moves.at(-1).san, uci: game.moves.at(-1).uci } : null,
    whitePlayerId: game.whitePlayer ? String(game.whitePlayer) : null,
    blackPlayerId: game.blackPlayer ? String(game.blackPlayer) : null,
    clocks: game.clocks?.whiteMs != null ? currentClocks(game, chess.turn()) : null,
    paused: !!game.paused,
    drawOfferBy: game.drawOfferBy || null,
  };
}

// Clock values "now": the side to move has been losing time since lastMoveAt.
export function currentClocks(game, turn) {
  const { whiteMs, blackMs, lastMoveAt } = game.clocks;
  const running = game.status === "in_progress" && !game.paused && lastMoveAt && game.ply > 0;
  const elapsed = running ? Date.now() - new Date(lastMoveAt).getTime() : 0;
  return {
    whiteMs: Math.max(0, whiteMs - (turn === "w" ? elapsed : 0)),
    blackMs: Math.max(0, blackMs - (turn === "b" ? elapsed : 0)),
    turn,
    running: !!running,
    serverTime: Date.now(),
  };
}

export async function cacheLiveState(game, chess) {
  const state = liveState(game, chess);
  await kvJson.set(stateKey(game._id), state, { ttlSec: LIVE_STATE_TTL_SEC });
  if (game.timeControl?.initialMs && state.clocks?.running) {
    const remaining = state.turn === "w" ? state.clocks.whiteMs : state.clocks.blackMs;
    await kv().zadd(DEADLINES_KEY, Date.now() + remaining, String(game._id));
  } else {
    await kv().zrem(DEADLINES_KEY, String(game._id));
  }
  return state;
}

export async function getLiveState(gameId) {
  const cached = await kvJson.get(stateKey(gameId));
  if (cached) return cached;
  const game = await GameSession.findById(gameId);
  return game ? cacheLiveState(game) : null;
}

// ---------------------------------------------------------------- lifecycle --

export async function loadGameFor(gameId, userId) {
  const game = await GameSession.findById(gameId);
  if (!game || !game.isParticipant(userId)) throw notFound("Game"); // 404, not 403: don't reveal existence
  return game;
}

export async function createGame(user, { mode = "ai", color = "white", difficulty = "intermediate", rated, timeControl }) {
  if (!["ai", "local"].includes(mode)) throw badRequest("Online games are created through matchmaking or rooms");
  const side = color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color === "black" ? "b" : "w";
  const game = new GameSession({
    player: user._id,
    mode,
    opponent: mode === "ai" ? "computer" : "human",
    difficulty: mode === "ai" ? difficulty : "pass-and-play",
    playerColor: mode === "ai" ? side : "w",
    whitePlayer: mode === "ai" && side === "w" ? user._id : null,
    blackPlayer: mode === "ai" && side === "b" ? user._id : null,
    rated: mode === "ai" ? rated ?? true : false,
    timeControl: timeControl?.initialMs ? timeControl : undefined,
    clocks: timeControl?.initialMs
      ? { whiteMs: timeControl.initialMs, blackMs: timeControl.initialMs, lastMoveAt: new Date() }
      : undefined,
  });
  await game.save();
  await publish(TOPICS.GAME_CREATED, "game.created", { gameId: String(game._id), mode, playerId: String(user._id) });
  metrics.gamesCreated.inc({ mode });
  if (isBotTurn(game)) return (await playBotMove(game)).game;
  await cacheLiveState(game);
  return game;
}

/**
 * Validate and persist one move.
 * @returns {{game, move, outcome}}
 */
export async function applyMove(game, { userId = null, input, clientMoveId, expectedPly, engine = false }) {
  if (game.status !== "in_progress") throw conflict("Game is not in progress", "GAME_NOT_ACTIVE");
  if (game.paused) throw conflict("Game is paused", "GAME_PAUSED");
  if (expectedPly != null && expectedPly !== game.ply) throw conflict("Position has changed; resync", "STALE_POSITION");

  const chess = replay(game);
  const color = chess.turn();
  if (!engine && !moverAllowed(game, userId, color)) throw forbidden("It is not your turn", "NOT_YOUR_TURN");

  // Clock: deduct thinking time; flag fall ends the game instead of moving.
  let clocks = game.clocks?.whiteMs != null
    ? { whiteMs: game.clocks.whiteMs, blackMs: game.clocks.blackMs, lastMoveAt: game.clocks.lastMoveAt }
    : null;
  if (clocks && game.ply > 0) {
    const now = currentClocks(game, color);
    const remaining = color === "w" ? now.whiteMs : now.blackMs;
    if (remaining <= 0) {
      const finished = await finishGame(game._id, { result: color === "w" ? "0-1" : "1-0", reason: "timeout" });
      return { game: finished, move: null, outcome: { result: finished.result, reason: "timeout" } };
    }
    const inc = game.timeControl?.incrementMs || 0;
    clocks = { ...clocks, whiteMs: now.whiteMs + (color === "w" ? inc : 0), blackMs: now.blackMs + (color === "b" ? inc : 0) };
  }
  if (clocks) clocks.lastMoveAt = new Date();

  let played;
  try {
    played = chess.move(normalizeMoveInput(input));
  } catch {
    throw badRequest("Illegal move", { move: input }, "ILLEGAL_MOVE");
  }

  const record = {
    ply: game.ply + 1,
    san: played.san,
    uci: played.lan,
    color,
    fen: chess.fen(),
    move: played.san,
    by: engine ? null : userId,
    clientMoveId,
    clockMs: clocks ? (color === "w" ? clocks.whiteMs : clocks.blackMs) : undefined,
    timestamp: new Date(),
  };
  const sans = [...game.moves.map((m) => m.san || m.move), played.san];
  const opening = classifyOpening(sans);

  // Conditional update on ply = optimistic concurrency: two simultaneous moves
  // (double click, two instances) can't both be written.
  const updated = await GameSession.findOneAndUpdate(
    { _id: game._id, ply: game.ply, status: "in_progress" },
    {
      $push: { moves: record },
      $set: {
        currentFEN: chess.fen(),
        ply: game.ply + 1,
        drawOfferBy: null,
        ...(clocks ? { clocks } : {}),
        ...(opening ? { opening: { eco: opening.eco, name: opening.name } } : {}),
      },
    },
    { new: true }
  );
  if (!updated) throw conflict("Another move was made first; resync", "CONCURRENT_MOVE");

  metrics.movesTotal.inc({ mode: game.mode });
  publish(TOPICS.GAME_MOVE, "game.move", { gameId: String(game._id), ply: record.ply, san: record.san, by: record.by ? String(record.by) : null });

  const outcome = detectOutcome(chess);
  if (outcome) {
    const finished = await finishGame(updated._id, outcome);
    return { game: finished, move: record, outcome };
  }
  await cacheLiveState(updated, chess);
  return { game: updated, move: record, outcome: null };
}

export async function playBotMove(game) {
  const chess = replay(game);
  if (!isBotTurn(game, chess)) throw conflict("It is not the engine's turn", "NOT_ENGINE_TURN");
  const uci = await getBotMove(chess.fen(), game.difficulty);
  if (!uci) throw conflict("Engine found no move", "ENGINE_NO_MOVE");
  return applyMove(game, { input: uci, engine: true });
}

// Human move, then the engine's reply when it's an AI game.
export async function moveAndReply(game, userId, input, opts = {}) {
  const first = await applyMove(game, { userId, input, ...opts });
  if (first.outcome || first.game.mode !== "ai" || !isBotTurn(first.game)) return { ...first, reply: null };
  const second = await playBotMove(first.game);
  return { game: second.game, move: first.move, reply: second.move, outcome: second.outcome };
}

export async function resign(game, userId) {
  if (game.isFinished()) throw conflict("Game is already over", "GAME_NOT_ACTIVE");
  let loser;
  if (game.mode === "local") loser = replay(game).turn(); // side to move resigns
  else loser = game.colorOf(userId);
  if (!loser) throw forbidden("Not a player in this game");
  return finishGame(game._id, { result: loser === "w" ? "0-1" : "1-0", reason: "resignation" });
}

export async function abort(game) {
  if (game.isFinished()) throw conflict("Game is already over", "GAME_NOT_ACTIVE");
  if (game.ply >= 2) throw conflict("Games with two or more moves can't be aborted; resign instead", "ABORT_TOO_LATE");
  return finishGame(game._id, { result: "*", reason: "aborted" });
}

export async function agreeDraw(game) {
  if (game.isFinished()) throw conflict("Game is already over", "GAME_NOT_ACTIVE");
  return finishGame(game._id, { result: "1/2-1/2", reason: "agreement" });
}

/**
 * Idempotent: only the caller that flips status from active to finished
 * applies stats/ratings and publishes game.finished. Safe to call from
 * several instances (e.g. two clock sweepers).
 */
export async function finishGame(gameId, { result, reason }) {
  const aborted = reason === "aborted";
  const finished = await GameSession.findOneAndUpdate(
    { _id: gameId, status: { $in: ["in_progress", "waiting"] } },
    {
      $set: {
        status: aborted ? "abandoned" : "completed",
        result: aborted ? "*" : result,
        endReason: reason,
        completedAt: new Date(),
        paused: false,
        drawOfferBy: null,
      },
    },
    { new: true }
  );
  if (!finished) return GameSession.findById(gameId); // someone else finished it

  const chess = replay(finished);
  finished.pgn = await buildPgn(finished, chess);
  if (!aborted) await updateStatsAndRatings(finished);
  await finished.save();

  await kv().zrem(DEADLINES_KEY, String(finished._id));
  await cacheLiveState(finished, chess);
  metrics.gamesFinished.inc({ mode: finished.mode, reason });
  if (finished.mode === "online" && finished.whitePlayer && finished.blackPlayer) metrics.activeGames.dec();

  if (!aborted) {
    await publish(TOPICS.GAME_FINISHED, "game.finished", {
      gameId: String(finished._id),
      mode: finished.mode,
      playerId: String(finished.player),
      whitePlayerId: finished.whitePlayer ? String(finished.whitePlayer) : null,
      blackPlayerId: finished.blackPlayer ? String(finished.blackPlayer) : null,
      result: finished.result,
      reason,
      plies: finished.ply,
    });
  }
  return finished;
}

async function updateStatsAndRatings(game) {
  const humans = [];
  if (game.mode === "online") {
    humans.push({ id: game.whitePlayer, color: "w" }, { id: game.blackPlayer, color: "b" });
  } else if (game.mode === "ai") {
    humans.push({ id: game.player, color: game.playerColor });
  } else {
    await User.updateOne({ _id: game.player }, { $inc: { "chessStats.gamesPlayed": 1 } });
    return; // local games don't count as wins/losses for anyone
  }

  const users = await User.find({ _id: { $in: humans.map((h) => h.id).filter(Boolean) } });
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const scoreFor = (color) => (game.result === "1/2-1/2" ? 0.5 : (game.result === "1-0") === (color === "w") ? 1 : 0);
  const ratingOf = (h) => byId.get(String(h.id))?.chessStats?.rating ?? 800;
  const change = {};

  for (const h of humans) {
    const u = byId.get(String(h.id));
    if (!u) continue;
    const score = scoreFor(h.color);
    const inc = { "chessStats.gamesPlayed": 1 };
    inc[score === 1 ? "chessStats.wins" : score === 0 ? "chessStats.losses" : "chessStats.draws"] = 1;
    const update = { $inc: inc };

    if (game.rated) {
      const opponentRating = game.mode === "ai"
        ? DIFFICULTY[game.difficulty]?.elo ?? 1500
        : ratingOf(humans.find((x) => x.color !== h.color));
      const before = u.chessStats?.rating ?? 800;
      const delta = ratingDelta(before, opponentRating, score, u.chessStats?.gamesPlayed ?? 0);
      const after = applyDelta(before, delta);
      try {
        await RatingHistory.create({ user: u._id, game: game._id, before, after, delta: after - before, opponentRating, score });
      } catch (err) {
        if (err.code === 11000) continue; // already applied for this game
        throw err;
      }
      update.$set = { "chessStats.rating": after };
      update.$max = { "chessStats.peakRating": after };
      change[h.color === "w" ? "white" : "black"] = after - before;
      publish(TOPICS.RATING_UPDATED, "rating.updated", { userId: String(u._id), gameId: String(game._id), before, after });
    }
    await User.updateOne({ _id: u._id }, update);
  }
  if (Object.keys(change).length) game.ratingChange = change;
}

// ---------------------------------------------------------------- hints -----

// Hints cost one credit, earned by solving coding problems (the original
// CodeMate loop). Only in AI games, only on the player's own turn.
export async function useHint(game, userId) {
  if (game.mode !== "ai") throw badRequest("Hints are only available against the engine", undefined, "HINT_NOT_ALLOWED");
  if (game.status !== "in_progress") throw conflict("Game is not in progress", "GAME_NOT_ACTIVE");
  const chess = replay(game);
  if (chess.turn() !== game.playerColor) throw conflict("Wait for your turn", "NOT_YOUR_TURN");
  const spent = await User.findOneAndUpdate({ _id: userId, hintCredits: { $gte: 1 } }, { $inc: { hintCredits: -1 } }, { new: true });
  if (!spent) throw forbidden("No hint credits left. Solve a coding problem to earn one.", "NO_HINT_CREDITS");
  try {
    const res = await enginePool().search({ fen: chess.fen(), depth: 16 });
    const move = new Chess(chess.fen()).move(res.bestMove);
    await GameSession.updateOne({ _id: game._id }, { $inc: { hintsUsed: 1 } });
    return { bestMove: { san: move.san, uci: move.lan, from: move.from, to: move.to }, score: res.score, hintCredits: spent.hintCredits };
  } catch (err) {
    await User.updateOne({ _id: userId }, { $inc: { hintCredits: 1 } }); // refund
    throw err;
  }
}
