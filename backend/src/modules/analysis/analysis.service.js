import { Chess } from "chess.js";
import GameSession, { START_FEN } from "../games/gameSession.model.js";
import GameAnalysis from "./gameAnalysis.model.js";
import { replay } from "../games/game.service.js";
import { enginePool } from "../../infrastructure/stockfish/chessEngine.js";
import { scoreToCp, toWhitePov, MATE_CP } from "../../infrastructure/stockfish/uci.js";
import { isBookMove, BOOK_DEPTH } from "../chess/openings.js";
import {
  ANALYSIS_THRESHOLDS as T, THRESHOLDS_VERSION, classifyMove, moveAccuracy, winPercent, SIGNIFICANT,
} from "../../config/analysis.js";
import { env } from "../../config/env.js";
import { publish } from "../../infrastructure/kafka/index.js";
import { TOPICS } from "../../shared/events.js";
import { childLogger } from "../../infrastructure/logger/index.js";
import { metrics } from "../../infrastructure/metrics/index.js";

const log = childLogger("analysis");
const ENGINE_VERSION = "Stockfish 17.1";
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// ------------------------------------------------------------- position facts

function nonPawnMaterial(chess) {
  let total = 0;
  for (const row of chess.board()) for (const sq of row) if (sq && sq.type !== "p" && sq.type !== "k") total += VALUE[sq.type];
  return total;
}

export function phaseOf(chess, ply) {
  if (nonPawnMaterial(chess) <= T.endgameMaterial) return "endgame";
  return ply <= T.openingPlies ? "opening" : "middlegame";
}

// Enemy pieces worth >= 3 (or the king) attacked by the piece on `square`.
function attackedTargets(fen, square) {
  const board = new Chess(fen);
  const piece = board.get(square);
  if (!piece) return [];
  const targets = [];
  for (const row of board.board()) {
    for (const sq of row) {
      if (!sq || sq.color === piece.color || (sq.type !== "k" && VALUE[sq.type] < 3)) continue;
      if (board.attackers(sq.square, piece.color).includes(square)) targets.push(sq.square);
    }
  }
  return targets;
}

const isForkAfter = (fen, square) => attackedTargets(fen, square).length >= 2;

// Deterministic themes from engine facts + board geometry (spec §25: these are
// facts, not LLM guesses).
function detectThemes({ before, after, deliveredMate, played, best, reply, cpl, phase, isUserTimeLow }) {
  const themes = new Set();
  const significant = cpl >= T.themeMinCpl;
  if (before.mate != null && before.mate > 0 && !deliveredMate && !(after.mate != null && after.mate > 0)) themes.add("missed_mate");
  if (after.mate != null && after.mate < 0 && !(before.mate != null && before.mate < 0)) themes.add("allowed_mate");
  if (!significant) return [...themes];
  // Allowing an immediate mate is the whole story; material/fork tags would mislead.
  if (reply?.san?.includes("#")) {
    themes.add("king_safety");
    if (phase === "opening") themes.add("opening_principles");
    return [...themes];
  }

  if (reply?.captured && VALUE[reply.captured] >= 3) themes.add("hanging_piece");
  if (best && best.captured && VALUE[best.captured] >= 3 && played.lan !== best.lan) themes.add("missed_tactic");
  if (reply && isForkAfter(reply.after, reply.to)) themes.add("fork");
  if (best && played.lan !== best.lan && isForkAfter(best.after, best.to)) themes.add("missed_fork");
  if (themes.has("allowed_mate") || (reply?.san?.includes("+") && cpl >= 150)) themes.add("king_safety");
  if (played.piece === "k" && phase !== "endgame") themes.add("king_safety");
  if (phase === "endgame") themes.add("endgame_technique");
  if (phase === "opening") themes.add("opening_principles");
  if (isUserTimeLow) themes.add("time_management");
  return [...themes];
}

const uciToSan = (fen, ucis, max = 8) => {
  const c = new Chess(fen);
  const out = [];
  for (const u of ucis.slice(0, max)) {
    try { out.push(c.move(u).san); } catch { break; }
  }
  return out;
};

// ------------------------------------------------------------------ analysis

/**
 * Evaluate every position of the game once (N moves → N+1 searches, run in
 * parallel through the engine pool) and derive per-move facts.
 */
export async function computeAnalysis(game, { depth = env.ANALYSIS_DEPTH } = {}) {
  const chess = new Chess(game.initialFen || START_FEN);
  const positions = [{ fen: chess.fen(), chess: new Chess(chess.fen()) }];
  const played = [];
  for (const m of game.moves) {
    const mv = chess.move(m.san || m.move);
    played.push(mv);
    positions.push({ fen: chess.fen(), chess: new Chess(chess.fen()) });
  }
  const sans = played.map((m) => m.san);

  const evals = await Promise.all(
    positions.map(async ({ fen, chess: pc }) => {
      // Side to move is mated: encode as ±MATE_CP; mate distance stays null.
      if (pc.isCheckmate()) return { cp: pc.turn() === "w" ? -MATE_CP : MATE_CP, mate: null, best: null, pv: [] };
      if (pc.isDraw() || pc.isStalemate()) return { cp: 0, mate: null, best: null, pv: [] };
      const res = await enginePool().search({ fen, depth });
      const white = res.score ? toWhitePov(res.score, pc.turn()) : { type: "cp", value: 0 };
      return {
        cp: scoreToCp(white),
        mate: white.type === "mate" ? white.value : null,
        best: res.bestMove,
        pv: res.pv,
      };
    })
  );

  const initial = game.timeControl?.initialMs;
  const moveAnalysis = played.map((mv, i) => {
    const color = mv.color;
    const sign = color === "w" ? 1 : -1;
    const e0 = evals[i];
    const e1 = evals[i + 1];
    const clamp = (v) => Math.max(-T.cplClamp, Math.min(T.cplClamp, v));
    const moverBefore = sign * e0.cp;
    const moverAfter = sign * e1.cp;
    const isBest = !!e0.best && e0.best === mv.lan;
    const cpl = isBest ? 0 : Math.max(0, clamp(moverBefore) - clamp(moverAfter));
    const wBefore = winPercent(clamp(moverBefore));
    const wAfter = winPercent(clamp(moverAfter));
    const winDrop = isBest ? 0 : Math.max(0, wBefore - wAfter);
    const isBook = i < BOOK_DEPTH && isBookMove(sans, i);

    const fenBefore = positions[i].fen;
    let best = null;
    if (e0.best) { try { best = new Chess(fenBefore).move(e0.best); } catch { best = null; } }
    let reply = null;
    if (e1.best) { try { reply = new Chess(positions[i + 1].fen).move(e1.best); } catch { reply = null; } }

    const phase = phaseOf(positions[i].chess, i + 1);
    const clockMs = game.moves[i]?.clockMs;
    const mateBefore = e0.mate == null ? null : sign * e0.mate;
    const mateAfter = e1.mate == null ? null : sign * e1.mate;
    const themes = detectThemes({
      before: { mate: mateBefore }, after: { mate: mateAfter }, deliveredMate: positions[i + 1].chess.isCheckmate(), played: mv, best, reply, cpl, phase,
      isUserTimeLow: !!(initial && clockMs != null && clockMs < initial * 0.1),
    });

    return {
      moveNumber: Number(fenBefore.split(" ")[5]), // FEN full-move counter
      ply: i + 1,
      color,
      fenBefore,
      fenAfter: positions[i + 1].fen,
      playedMove: mv.san,
      playedMoveUci: mv.lan,
      bestMove: best?.san || null,
      bestMoveUci: e0.best,
      evaluationBefore: e0.cp,
      evaluationAfter: e1.cp,
      mateBefore: e0.mate,
      mateAfter: e1.mate,
      centipawnLoss: Math.round(cpl),
      accuracy: Math.round(moveAccuracy(wBefore, wAfter) * 10) / 10,
      classification: classifyMove({ isBest, isBook, cpl, winDrop }),
      principalVariation: uciToSan(fenBefore, e0.pv),
      themes,
      phase,
    };
  });

  const side = (color) => {
    const mine = moveAnalysis.filter((m) => m.color === color);
    const counts = { book: 0, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
    for (const m of mine) counts[m.classification]++;
    const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    return {
      accuracy: mine.length ? Math.round(avg(mine.map((m) => m.accuracy)) * 10) / 10 : null,
      averageCentipawnLoss: mine.length ? Math.round(avg(mine.map((m) => m.centipawnLoss))) : null,
      counts,
    };
  };

  const themeCounts = {};
  for (const m of moveAnalysis) for (const t of m.themes) themeCounts[t] = (themeCounts[t] || 0) + 1;

  return {
    engineVersion: ENGINE_VERSION,
    depth,
    thresholdsVersion: THRESHOLDS_VERSION,
    white: side("w"),
    black: side("b"),
    themes: Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).map(([t]) => t),
    moveAnalysis,
  };
}

// Which colours belong to the human(s) this analysis is for.
export const userColors = (game) => (game.mode === "local" ? ["w", "b"] : game.mode === "ai" ? [game.playerColor] : ["w", "b"]);

/**
 * Run (or re-run) analysis for a game and persist it. Idempotent: a completed
 * analysis with the current thresholds is returned as-is unless force=true.
 */
export async function analyzeGame(gameId, { force = false } = {}) {
  const game = await GameSession.findById(gameId);
  if (!game) throw new Error(`Game ${gameId} not found`);
  const existing = await GameAnalysis.findOne({ gameSession: gameId });
  if (!force && existing?.status === "completed" && existing.thresholdsVersion === THRESHOLDS_VERSION) return existing;
  if (!game.moves.length) throw new Error("Game has no moves to analyze");

  await GameSession.updateOne({ _id: gameId }, { analysisStatus: "running" });
  await GameAnalysis.updateOne(
    { gameSession: gameId },
    { $set: { status: "running", error: null }, $setOnInsert: { gameSession: gameId } },
    { upsert: true }
  );
  const end = metrics.stockfishAnalysis.startTimer();
  const started = Date.now();
  try {
    // Ensure moves replay (throws for corrupt legacy data before we spend engine time).
    replay(game);
    const result = await computeAnalysis(game);
    const analysis = await GameAnalysis.findOneAndUpdate(
      { gameSession: gameId },
      {
        $set: {
          ...result,
          status: "completed",
          durationMs: Date.now() - started,
          aiStatus: "pending",
          // keep legacy summary fields populated for old clients
          playerAccuracy: result[game.playerColor === "b" ? "black" : "white"].accuracy,
          computerAccuracy: result[game.playerColor === "b" ? "white" : "black"].accuracy,
          bestMoveCount: result.moveAnalysis.filter((m) => m.classification === "best").length,
          inaccuracies: result.moveAnalysis.filter((m) => m.classification === "inaccuracy").length,
          mistakes: result.moveAnalysis.filter((m) => m.classification === "mistake").length,
          blunders: result.moveAnalysis.filter((m) => m.classification === "blunder").length,
        },
      },
      { new: true }
    );
    await GameSession.updateOne({ _id: gameId }, { analysisStatus: "completed" });
    end();
    await publish(TOPICS.ANALYSIS_COMPLETED, "analysis.completed", {
      gameId: String(gameId),
      analysisId: String(analysis._id),
      userIds: [game.player, game.whitePlayer, game.blackPlayer].filter(Boolean).map(String).filter((v, i, a) => a.indexOf(v) === i),
      significantMoves: result.moveAnalysis.filter((m) => SIGNIFICANT.has(m.classification)).length,
    });
    return analysis;
  } catch (err) {
    end();
    log.error({ err, gameId: String(gameId) }, "Analysis failed");
    await GameAnalysis.updateOne({ gameSession: gameId }, { status: "failed", error: err.message });
    await GameSession.updateOne({ _id: gameId }, { analysisStatus: "failed" });
    throw err;
  }
}

export async function requestAnalysis(game, userId) {
  if (!game.isFinished()) return { status: "not_finished" };
  if (!game.moves.length) return { status: "no_moves" };
  const existing = await GameAnalysis.findOne({ gameSession: game._id }).select("status thresholdsVersion");
  if (existing?.status === "completed" && existing.thresholdsVersion === THRESHOLDS_VERSION) return { status: "completed" };
  if (existing && ["pending", "running"].includes(existing.status)) return { status: existing.status };
  await GameAnalysis.updateOne(
    { gameSession: game._id },
    { $set: { status: "pending" }, $setOnInsert: { gameSession: game._id } },
    { upsert: true }
  );
  await GameSession.updateOne({ _id: game._id }, { analysisStatus: "pending" });
  await publish(TOPICS.ANALYSIS_REQUESTED, "analysis.requested", { gameId: String(game._id), requestedBy: String(userId) });
  return { status: "pending" };
}
