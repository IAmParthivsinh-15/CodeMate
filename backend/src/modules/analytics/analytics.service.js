import mongoose from "mongoose";
import User from "../users/user.model.js";
import GameSession from "../games/gameSession.model.js";
import GameAnalysis from "../analysis/gameAnalysis.model.js";
import Submission from "../coding/submission.model.js";
import Puzzle from "../learning/puzzle.model.js";
import RatingHistory from "../ratings/ratingHistory.model.js";
import UserStats from "./userStats.model.js";
import CodingQuestion from "../coding/codingQuestion.model.js";
import { userColors } from "../analysis/analysis.service.js";
import { kv, kvJson } from "../../infrastructure/redis/index.js";
import { THEME_LABELS } from "../../config/analysis.js";

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const DASHBOARD_TTL = 60;
const LEADERBOARD_TTL = 300;
export const dashboardKey = (userId) => `dashboard:${userId}`;

// ------------------------------------------------ incremental aggregates ---
// Maintained by the analytics worker. Each event is applied at most once
// (processedEvents guard), so replays and duplicate deliveries are harmless.

async function applyOnce(userId, eventKey, update) {
  await UserStats.updateOne({ user: userId }, { $setOnInsert: { user: userId } }, { upsert: true });
  const res = await UserStats.updateOne(
    { user: userId, processedEvents: { $ne: eventKey } },
    { ...update, $push: { processedEvents: { $each: [eventKey], $slice: -1000 } } }
  );
  if (res.modifiedCount) await kv().del(dashboardKey(userId));
  return res.modifiedCount > 0;
}

export async function applyAnalysisToStats(gameId) {
  const [game, analysis] = await Promise.all([GameSession.findById(gameId), GameAnalysis.findOne({ gameSession: gameId }).lean()]);
  if (!game || analysis?.status !== "completed") return;
  const owners = game.mode === "online"
    ? [{ id: game.whitePlayer, colors: ["w"] }, { id: game.blackPlayer, colors: ["b"] }]
    : [{ id: game.player, colors: userColors(game) }];
  for (const { id, colors } of owners) {
    if (!id) continue;
    const moves = analysis.moveAnalysis.filter((m) => colors.includes(m.color));
    if (!moves.length) continue;
    const inc = {
      "chess.gamesAnalyzed": 1,
      "chess.movesAnalyzed": moves.length,
      "chess.accuracySum": moves.reduce((a, m) => a + (m.accuracy || 0), 0),
      "chess.cplSum": moves.reduce((a, m) => a + Math.min(m.centipawnLoss || 0, 1000), 0),
    };
    for (const m of moves) {
      inc[`chess.classifications.${m.classification}`] = (inc[`chess.classifications.${m.classification}`] || 0) + 1;
      inc[`chess.phaseCpl.${m.phase}`] = (inc[`chess.phaseCpl.${m.phase}`] || 0) + Math.min(m.centipawnLoss || 0, 1000);
      inc[`chess.phaseMoves.${m.phase}`] = (inc[`chess.phaseMoves.${m.phase}`] || 0) + 1;
      for (const t of m.themes || []) inc[`chess.themes.${t}`] = (inc[`chess.themes.${t}`] || 0) + 1;
    }
    await applyOnce(id, `analysis:${analysis._id}:${analysis.updatedAt?.getTime?.() ?? ""}`, { $inc: inc });
  }
}

export async function applyChatToStats({ eventId, payload }) {
  if (!payload?.userId) return;
  const inc = { "ai.questions": 1 };
  for (const c of payload.concepts || []) inc[`ai.concepts.${c.replace(/[.$]/g, "_")}`] = 1;
  await applyOnce(payload.userId, `chat:${eventId}`, { $inc: inc });
}

export const invalidateDashboard = (userId) => kv().del(dashboardKey(userId));

// Full recomputation from source collections (repair tool: npm run stats:rebuild).
export async function rebuildUserStats(userId) {
  await UserStats.deleteOne({ user: userId });
  const games = await GameSession.find({ analysisStatus: "completed", $or: [{ player: userId }, { whitePlayer: userId }, { blackPlayer: userId }] }).select("_id");
  for (const g of games) await applyAnalysisToStats(g._id);
}

// -------------------------------------------------------------- statistics ---

const mapObj = (m) => (m instanceof Map ? Object.fromEntries(m) : m || {});

export async function chessStatistics(userId) {
  const [user, stats] = await Promise.all([User.findById(userId).lean(), UserStats.findOne({ user: userId }).lean()]);
  const cs = user?.chessStats || {};
  const decided = (cs.wins || 0) + (cs.losses || 0) + (cs.draws || 0);
  const c = stats?.chess || {};
  const phaseCpl = mapObj(c.phaseCpl);
  const phaseMoves = mapObj(c.phaseMoves);

  // Openings: recent completed games grouped by opening name.
  const recent = await GameSession.find({
    status: { $in: ["completed", "won", "lost", "draw"] }, "opening.name": { $exists: true },
    $or: [{ player: userId }, { whitePlayer: userId }, { blackPlayer: userId }],
  }).sort({ completedAt: -1 }).limit(200).select("opening result status mode player playerColor whitePlayer blackPlayer");
  const openings = {};
  for (const g of recent) {
    const o = (openings[g.opening.name] ||= { name: g.opening.name, eco: g.opening.eco, games: 0, wins: 0, draws: 0, losses: 0 });
    o.games++;
    const out = g.outcomeFor(userId);
    if (out === "win") o.wins++; else if (out === "draw") o.draws++; else if (out === "loss") o.losses++;
  }

  return {
    rating: cs.rating ?? 800,
    peakRating: cs.peakRating ?? cs.rating ?? 800,
    games: cs.gamesPlayed || 0,
    wins: cs.wins || 0,
    losses: cs.losses || 0,
    draws: cs.draws || 0,
    winRate: decided ? Math.round(((cs.wins || 0) / decided) * 1000) / 10 : null,
    gamesAnalyzed: c.gamesAnalyzed || 0,
    accuracy: c.movesAnalyzed ? Math.round((c.accuracySum / c.movesAnalyzed) * 10) / 10 : null,
    averageCentipawnLoss: c.movesAnalyzed ? Math.round(c.cplSum / c.movesAnalyzed) : null,
    mistakeDistribution: mapObj(c.classifications),
    phaseCpl: Object.fromEntries(Object.keys(phaseMoves).map((p) => [p, Math.round(phaseCpl[p] / phaseMoves[p])])),
    themes: Object.entries(mapObj(c.themes)).sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ theme: t, label: THEME_LABELS[t] || t, count: n })),
    openings: Object.values(openings).sort((a, b) => b.games - a.games).slice(0, 8),
  };
}

export async function codingStatistics(userId) {
  const uid = oid(userId);
  const [user, byLanguage, solvedProblems, recent, byStatus] = await Promise.all([
    User.findById(userId).lean(),
    Submission.aggregate([{ $match: { user: uid, kind: "submit" } }, { $group: { _id: "$language", count: { $sum: 1 }, accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } } } }]),
    Submission.distinct("problem", { user: uid, status: "accepted", kind: "submit" }),
    Submission.find({ user: uid }).sort({ createdAt: -1 }).limit(5).select("problem language status score kind createdAt").populate("problem", "title slug difficulty").lean(),
    Submission.aggregate([{ $match: { user: uid, kind: "submit" } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const difficulty = await CodingQuestion.aggregate([{ $match: { _id: { $in: solvedProblems } } }, { $group: { _id: "$difficulty", count: { $sum: 1 } } }]);
  const total = byLanguage.reduce((a, l) => a + l.count, 0);
  const accepted = byLanguage.reduce((a, l) => a + l.accepted, 0);
  return {
    problemsSolved: solvedProblems.length,
    submissions: total,
    accepted,
    acceptanceRate: total ? Math.round((accepted / total) * 1000) / 10 : null,
    languages: byLanguage.map((l) => ({ language: l._id, submissions: l.count, accepted: l.accepted })).sort((a, b) => b.submissions - a.submissions),
    difficulty: Object.fromEntries(difficulty.map((d) => [d._id, d.count])),
    statuses: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
    recentSubmissions: recent,
    hintCredits: user?.hintCredits ?? 0,
  };
}

export async function getUserStatistics(userId) {
  const [chess, coding] = await Promise.all([chessStatistics(userId), codingStatistics(userId)]);
  return { chess, coding };
}

export async function getDashboard(userId) {
  const key = dashboardKey(userId);
  const cached = await kvJson.get(key);
  if (cached) return { ...cached, cached: true };

  const uid = oid(userId);
  const [chess, coding, stats, puzzles, ratingHistory, recentGames, analysisPending] = await Promise.all([
    chessStatistics(userId),
    codingStatistics(userId),
    UserStats.findOne({ user: userId }).lean(),
    Puzzle.aggregate([{ $match: { user: uid } }, { $group: { _id: null, total: { $sum: 1 }, solved: { $sum: { $cond: [{ $ifNull: ["$solvedAt", false] }, 1, 0] } } } }]),
    RatingHistory.find({ user: userId }).sort({ createdAt: -1 }).limit(30).select("after delta createdAt").lean(),
    GameSession.find({ $or: [{ player: userId }, { whitePlayer: userId }, { blackPlayer: userId }] }).sort({ createdAt: -1 }).limit(5)
      .select("mode status result difficulty opening createdAt analysisStatus ply player playerColor whitePlayer blackPlayer endReason"),
    GameSession.countDocuments({ $or: [{ player: userId }, { whitePlayer: userId }, { blackPlayer: userId }], analysisStatus: { $in: ["pending", "running"] } }),
  ]);
  const concepts = Object.entries(mapObj(stats?.ai?.concepts)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([concept, count]) => ({ concept, count }));
  const topThemes = chess.themes.filter((t) => !["opening_principles", "endgame_technique"].includes(t.theme)).slice(0, 3);

  const data = {
    chess: { ...chess, ratingHistory: ratingHistory.reverse().map((r) => ({ at: r.createdAt, rating: r.after, delta: r.delta })) },
    coding,
    ai: {
      gamesAnalyzed: chess.gamesAnalyzed,
      analysisPending,
      questions: stats?.ai?.questions || 0,
      topConcepts: concepts,
      recommendations: topThemes.map((t) => ({ theme: t.theme, text: `Practise positions on "${t.label}" (seen ${t.count} times in your analysed moves).` })),
    },
    learning: { puzzles: puzzles[0]?.total || 0, puzzlesSolved: puzzles[0]?.solved || 0 },
    recentGames: recentGames.map((g) => ({
      _id: g._id, mode: g.mode, status: g.status, result: g.result, outcome: g.outcomeFor(userId), difficulty: g.difficulty,
      opening: g.opening?.name || null, createdAt: g.createdAt, analysisStatus: g.analysisStatus, plies: g.ply, endReason: g.endReason,
    })),
    generatedAt: new Date(),
  };
  await kvJson.set(key, data, { ttlSec: DASHBOARD_TTL });
  return data;
}

// Leaderboards (spec §40: leaderboard:{period} cache).
export async function getLeaderboard(period = "all") {
  const key = `leaderboard:${period}`;
  const cached = await kvJson.get(key);
  if (cached) return cached;
  let rows;
  if (period === "month") {
    const since = new Date(Date.now() - 30 * 864e5);
    const agg = await RatingHistory.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$user", gained: { $sum: "$delta" }, games: { $sum: 1 } } },
      { $sort: { gained: -1 } },
      { $limit: 50 },
    ]);
    const users = await User.find({ _id: { $in: agg.map((a) => a._id) } }).select("username chessStats.rating").lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    rows = agg.map((a, i) => ({ rank: i + 1, userId: a._id, username: byId.get(String(a._id))?.username, rating: byId.get(String(a._id))?.chessStats?.rating, gained: a.gained, games: a.games }));
  } else {
    const users = await User.find({ "chessStats.gamesPlayed": { $gt: 0 } }).sort({ "chessStats.rating": -1 }).limit(50).select("username chessStats codingStats.problemsSolved").lean();
    rows = users.map((u, i) => ({ rank: i + 1, userId: u._id, username: u.username, rating: u.chessStats.rating, games: u.chessStats.gamesPlayed, problemsSolved: u.codingStats?.problemsSolved || 0 }));
  }
  const data = { period, rows, generatedAt: new Date() };
  await kvJson.set(key, data, { ttlSec: LEADERBOARD_TTL });
  return data;
}
