import mongoose from "mongoose";
import GameSession from "../games/gameSession.model.js";
import GameAnalysis from "../analysis/gameAnalysis.model.js";
import Puzzle from "../learning/puzzle.model.js";
import RatingHistory from "../ratings/ratingHistory.model.js";
import KnowledgeChunk from "./knowledgeChunk.model.js";
import ChatThread from "./chatThread.model.js";
import { userColors } from "../analysis/analysis.service.js";
import { THEME_KNOWLEDGE, THEME_LABELS, SIGNIFICANT } from "../../config/analysis.js";
import { llm } from "../../infrastructure/llm/index.js";
import { chatAnswerSchema } from "./grounding.js";
import { render } from "./prompts.js";
import { childLogger } from "../../infrastructure/logger/index.js";

const log = childLogger("coach");

export const MIN_GAMES = 3;
const RECENT_GAMES = 20;

// Skill categories (spec §34) and the stored metrics each one is computed from.
// A category's "rate" is its mistakes per 100 of the player's moves.
export const SKILL_CATEGORIES = {
  opening: { label: "Opening", test: (m) => m.phase === "opening" && SIGNIFICANT.has(m.classification) },
  tactics: { label: "Tactics", test: (m) => m.themes?.some((t) => ["hanging_piece", "missed_tactic", "fork", "missed_fork"].includes(t)) },
  strategy: { label: "Strategy", test: (m) => m.phase === "middlegame" && m.classification === "inaccuracy" },
  king_safety: { label: "King safety", test: (m) => m.themes?.some((t) => ["king_safety", "allowed_mate"].includes(t)) },
  calculation: { label: "Calculation", test: (m) => m.classification === "blunder" },
  endgame: { label: "Endgame", test: (m) => m.phase === "endgame" && SIGNIFICANT.has(m.classification) },
  time_management: { label: "Time management", test: (m) => m.themes?.includes("time_management") },
};
const CATEGORY_THEMES = {
  opening: ["opening_principles"], tactics: ["hanging_piece", "missed_tactic", "fork"], strategy: [],
  king_safety: ["king_safety", "allowed_mate"], calculation: ["missed_tactic"], endgame: ["endgame_technique"], time_management: ["time_management"],
};
const CATEGORY_DOCS = {
  strategy: ["strategy/piece_activity.md", "middlegame/planning.md"],
  calculation: ["middlegame/calculation.md"],
};

const round1 = (x) => Math.round(x * 10) / 10;
const per100 = (n, moves) => (moves ? round1((n / moves) * 100) : 0);

// Trend from older vs newer halves of the sample (needs >= 2 games per half).
function trend(older, newer) {
  if (older.moves < 20 || newer.moves < 20 || older.games < 2 || newer.games < 2) return "not_enough_data";
  const a = older.count / older.moves;
  const b = newer.count / newer.moves;
  if (a === 0 && b === 0) return "stable";
  const change = (b - a) / Math.max(a, 0.005);
  if (change <= -0.2) return "improving";
  if (change >= 0.2) return "needs_attention";
  return "stable";
}

async function docTitles(sources) {
  const chunks = await KnowledgeChunk.find({ source: { $in: sources } }).select("source title").lean();
  const bySource = new Map(chunks.map((c) => [c.source, c.title]));
  return sources.filter((s) => bySource.has(s)).map((s) => ({ source: s, title: bySource.get(s) }));
}

/**
 * Evidence report (spec §31): everything here is computed from stored games,
 * analyses, puzzles and ratings. The optional LLM narrative may only restate it.
 */
export async function buildCoachReport(userId) {
  const games = await GameSession.find({
    analysisStatus: "completed",
    $or: [{ player: userId }, { whitePlayer: userId }, { blackPlayer: userId }],
  }).sort({ completedAt: -1 }).limit(RECENT_GAMES);
  const analyses = await GameAnalysis.find({ gameSession: { $in: games.map((g) => g._id) }, status: "completed" }).lean();
  const byGame = new Map(analyses.map((a) => [String(a.gameSession), a]));

  // Chronological (oldest first) list of {game, myMoves}
  const samples = games
    .map((g) => {
      const a = byGame.get(String(g._id));
      if (!a) return null;
      const colors = g.mode === "online" ? [g.colorOf(userId)] : userColors(g);
      return { game: g, moves: a.moveAnalysis.filter((m) => colors.includes(m.color)), analysis: a };
    })
    .filter(Boolean)
    .reverse();

  if (samples.length < MIN_GAMES) {
    return {
      enoughData: false,
      gamesAnalyzed: samples.length,
      minimumGames: MIN_GAMES,
      message: `The coach needs at least ${MIN_GAMES} analysed games; you have ${samples.length}. Finish and analyse a few more games.`,
    };
  }

  const allMoves = samples.flatMap((s) => s.moves);
  const totalMoves = allMoves.length;
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  // Phases
  const phases = ["opening", "middlegame", "endgame"].map((phase) => {
    const ms = allMoves.filter((m) => m.phase === phase);
    return {
      phase,
      moves: ms.length,
      averageCentipawnLoss: Math.round(avg(ms.map((m) => Math.min(m.centipawnLoss, 1000)))),
      mistakesPer100: per100(ms.filter((m) => SIGNIFICANT.has(m.classification)).length, ms.length),
    };
  });

  // Themes: in how many games did each appear?
  const themeGames = {};
  const themeExamples = {};
  for (const s of samples) {
    const seen = new Set();
    for (const m of s.moves) for (const t of m.themes || []) {
      seen.add(t);
      if (!themeExamples[t] || m.centipawnLoss > themeExamples[t].centipawnLoss) {
        themeExamples[t] = { gameId: s.game._id, ply: m.ply, moveNumber: m.moveNumber, playedMove: m.playedMove, bestMove: m.bestMove, centipawnLoss: m.centipawnLoss };
      }
    }
    seen.forEach((t) => { themeGames[t] = (themeGames[t] || 0) + 1; });
  }
  const recurring = Object.entries(themeGames)
    .filter(([t, n]) => n >= 2 && n / samples.length >= 0.3 && !["opening_principles", "endgame_technique"].includes(t))
    .sort((a, b) => b[1] - a[1])
    .map(([theme, n]) => ({ theme, label: THEME_LABELS[theme] || theme, games: n, share: round1((n / samples.length) * 100), example: themeExamples[theme] }));

  // Skill categories with trends
  const half = Math.floor(samples.length / 2);
  const older = samples.slice(0, half);
  const newer = samples.slice(half);
  const countIn = (list, test) => ({
    count: list.flatMap((s) => s.moves).filter(test).length,
    moves: list.flatMap((s) => s.moves).length,
    games: list.length,
  });
  const categories = Object.entries(SKILL_CATEGORIES).map(([key, c]) => {
    const all = countIn(samples, c.test);
    return { key, label: c.label, mistakes: all.count, per100Moves: per100(all.count, all.moves), trend: trend(countIn(older, c.test), countIn(newer, c.test)) };
  });

  // Openings (by name) from the player's point of view
  const openings = {};
  for (const s of samples) {
    const name = s.game.opening?.name || "Unclassified";
    const o = (openings[name] ||= { name, games: 0, wins: 0, draws: 0, losses: 0, accuracy: [] });
    o.games++;
    const out = s.game.outcomeFor(userId);
    if (out === "win") o.wins++; else if (out === "draw") o.draws++; else if (out === "loss") o.losses++;
    o.accuracy.push(avg(s.moves.map((m) => m.accuracy)));
  }
  const openingStats = Object.values(openings)
    .map((o) => ({ ...o, score: o.games ? round1(((o.wins + o.draws / 2) / o.games) * 100) : 0, accuracy: round1(avg(o.accuracy)) }))
    .sort((a, b) => b.games - a.games);

  // Time management (timed games only)
  const timed = samples.filter((s) => s.game.timeControl?.initialMs);
  const lowClockMistakes = allMoves.filter((m) => m.themes?.includes("time_management")).length;
  const timeouts = timed.filter((s) => s.game.endReason === "timeout" && s.game.outcomeFor(userId) === "loss").length;

  // Puzzles and ratings
  const puzzles = await Puzzle.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
    { $group: { _id: "$theme", total: { $sum: 1 }, solved: { $sum: { $cond: [{ $ifNull: ["$solvedAt", false] }, 1, 0] } } } },
  ]).catch(() => []);
  const rating = await RatingHistory.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean();

  // Strengths / weaknesses with their evidence
  const strengths = [];
  const weaknesses = [];
  const overallAcc = round1(avg(allMoves.map((m) => m.accuracy)));
  const byRate = [...categories].filter((c) => c.key !== "time_management" || timed.length).sort((a, b) => a.per100Moves - b.per100Moves);
  for (const c of byRate.slice(0, 2)) if (c.per100Moves <= 2) strengths.push({ category: c.key, text: `${c.label}: only ${c.mistakes} mistake(s) in ${totalMoves} moves (${c.per100Moves} per 100).` });
  for (const c of byRate.slice(-3).reverse()) if (c.per100Moves >= 3) weaknesses.push({ category: c.key, text: `${c.label}: ${c.mistakes} mistake(s), ${c.per100Moves} per 100 moves.` });
  for (const o of openingStats.filter((x) => x.games >= 2)) {
    if (o.score >= 65) strengths.push({ category: "opening", text: `${o.name}: scored ${o.score}% over ${o.games} games.` });
    if (o.score <= 35) weaknesses.push({ category: "opening", text: `${o.name}: scored ${o.score}% over ${o.games} games.` });
  }

  // Recommendations from weaknesses and recurring themes
  const weakKeys = weaknesses.map((w) => w.category);
  const recThemes = [...new Set([...recurring.map((r) => r.theme), ...weakKeys.flatMap((k) => CATEGORY_THEMES[k] || [])])];
  const recSources = [...new Set([...recThemes.flatMap((t) => THEME_KNOWLEDGE[t] || []), ...weakKeys.flatMap((k) => CATEGORY_DOCS[k] || [])])].slice(0, 5);
  const concepts = await docTitles(recSources);
  const recommendedPuzzles = recThemes.length
    ? await Puzzle.find({ user: userId, solvedAt: null, themes: { $in: recThemes } }).sort({ createdAt: -1 }).limit(5).select("_id theme difficulty sourceMoveNumber").lean()
    : [];

  const plan = [];
  concepts.slice(0, 3).forEach((c, i) => plan.push({ step: i + 1, type: "study", text: `Study "${c.title}" in the chess guide.`, source: c.source }));
  if (recommendedPuzzles.length) plan.push({ step: plan.length + 1, type: "puzzles", text: `Solve ${recommendedPuzzles.length} puzzle(s) built from your own mistakes on: ${[...new Set(recommendedPuzzles.map((p) => THEME_LABELS[p.theme] || p.theme))].join(", ")}.` });
  if (recurring[0]) plan.push({ step: plan.length + 1, type: "play", text: `Play 3 games focusing on avoiding: ${recurring[0].label}. Before each move, check your opponent's forcing replies.` });
  if (timed.length && (lowClockMistakes >= 3 || timeouts >= 1)) plan.push({ step: plan.length + 1, type: "habit", text: "Budget your clock: aim to keep at least a third of your time at move 25." });

  return {
    enoughData: true,
    generatedAt: new Date(),
    gamesAnalyzed: samples.length,
    movesAnalyzed: totalMoves,
    accuracy: overallAcc,
    averageCentipawnLoss: Math.round(avg(allMoves.map((m) => Math.min(m.centipawnLoss, 1000)))),
    classifications: Object.fromEntries(["best", "excellent", "good", "book", "inaccuracy", "mistake", "blunder"].map((c) => [c, allMoves.filter((m) => m.classification === c).length])),
    phases,
    categories,
    recurringMistakes: recurring,
    openings: openingStats.slice(0, 8),
    timeManagement: { timedGames: timed.length, lowClockMistakes, timeoutLosses: timeouts },
    puzzles: puzzles.map((p) => ({ theme: p._id, label: THEME_LABELS[p._id] || p._id, total: p.total, solved: p.solved })),
    ratingHistory: rating.reverse().map((r) => ({ at: r.createdAt, rating: r.after, delta: r.delta })),
    strengths,
    weaknesses,
    recommendedConcepts: concepts,
    recommendedPuzzles,
    trainingPlan: plan,
  };
}

// Compact version of the report for the LLM prompt (numbers only, no ids).
const reportForPrompt = (r) => ({
  gamesAnalyzed: r.gamesAnalyzed, movesAnalyzed: r.movesAnalyzed, accuracy: r.accuracy, averageCentipawnLoss: r.averageCentipawnLoss,
  classifications: r.classifications, phases: r.phases, categories: r.categories,
  recurringMistakes: r.recurringMistakes.map(({ label, games, share }) => ({ label, games, share })),
  openings: r.openings.map(({ name, games, score }) => ({ name, games, score })),
  timeManagement: r.timeManagement, strengths: r.strengths.map((s) => s.text), weaknesses: r.weaknesses.map((w) => w.text),
  trainingPlan: r.trainingPlan.map((p) => p.text),
});

function narrativeFallback(r) {
  const lines = [`Across your last **${r.gamesAnalyzed} analysed games** (${r.movesAnalyzed} moves) your accuracy is **${r.accuracy}%** with an average centipawn loss of ${r.averageCentipawnLoss}.`];
  if (r.strengths.length) lines.push(`**Strengths:** ${r.strengths.map((s) => s.text).join(" ")}`);
  if (r.weaknesses.length) lines.push(`**To work on:** ${r.weaknesses.map((w) => w.text).join(" ")}`);
  if (r.recurringMistakes.length) lines.push(`**Recurring:** ${r.recurringMistakes.map((m) => `${m.label} (${m.games} of ${r.gamesAnalyzed} games)`).join(", ")}.`);
  const moving = r.categories.filter((c) => ["improving", "needs_attention"].includes(c.trend));
  if (moving.length) lines.push(`**Trends:** ${moving.map((c) => `${c.label} ${c.trend === "improving" ? "↑ improving" : "↓ needs attention"}`).join(", ")}.`);
  return { answer: lines.join("\n\n"), keyConcepts: r.recurringMistakes.map((m) => m.label.toLowerCase()).slice(0, 4), recommendations: r.trainingPlan.map((p) => p.text).slice(0, 4) };
}

export async function coachNarrative(user, report, question) {
  if (!report.enoughData) return { answer: report.message, keyConcepts: [], recommendations: [], provider: "none", degraded: true };
  let out = null;
  if (llm.enabled) {
    try {
      out = await llm.generate({
        task: "coach",
        system: render("coach", {
          report: reportForPrompt(report),
          task: question ? `Answer the player's question: "${question}"` : "Write a short personal coaching summary: strengths, weaknesses, and what to do this week.",
        }),
        messages: [{ role: "user", content: question || "Coach me." }],
        json: true,
        schema: chatAnswerSchema,
      });
    } catch (err) {
      log.warn({ err: err.message }, "Coach narrative fell back");
    }
  }
  const answer = out?.data || narrativeFallback(report);
  const result = { ...answer, provider: out?.provider || "none", model: out?.model || null, degraded: !out };
  if (question) {
    await ChatThread.findOneAndUpdate(
      { user: user._id, scope: "coach", game: null },
      { $push: { messages: { $each: [{ role: "user", content: question }, { role: "assistant", content: result.answer, keyConcepts: result.keyConcepts, recommendations: result.recommendations, provider: result.provider, degraded: result.degraded }], $slice: -100 } } },
      { upsert: true }
    );
  }
  return result;
}
