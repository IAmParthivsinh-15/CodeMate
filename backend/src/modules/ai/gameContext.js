import GameAnalysis from "../analysis/gameAnalysis.model.js";
import GameSession from "../games/gameSession.model.js";
import { userColors } from "../analysis/analysis.service.js";
import { SIGNIFICANT, THEME_LABELS, winPercent } from "../../config/analysis.js";
import { formatEval } from "./grounding.js";

const MAX_MOVES = 6;
const colorName = (c) => (c === "w" ? "White" : "Black");

/**
 * Game Analysis RAG retrieval (spec §13): pick the moves the question is
 * about instead of sending the whole game to the LLM (spec §56).
 */
export function selectRelevantMoves(question, analysis, colors, selectedPly) {
  const moves = analysis?.moveAnalysis || [];
  if (!moves.length) return { moves: [], reason: "no analysis" };
  const mine = moves.filter((m) => colors.includes(m.color));
  const q = question.toLowerCase();
  const picked = new Map();
  const add = (m, why) => m && !picked.has(m.ply) && picked.size < MAX_MOVES && picked.set(m.ply, { ...m, why });
  const byCpl = (list) => [...list].sort((a, b) => b.centipawnLoss - a.centipawnLoss);

  // 1. Explicit move numbers: "move 23", "23.", "23...", "on 23"
  for (const match of q.matchAll(/(?:move\s*|\bon\s+)?\b(\d{1,3})\s*(\.{3}|\.)?/g)) {
    const n = Number(match[1]);
    if (!n || n > 300 || (!/move|\bon\s/.test(match[0]) && !match[2])) continue;
    // "23..." means Black's 23rd move; a single "." is too ambiguous (sentence end) to mean White.
    const color = match[2] === "..." ? "b" : null;
    const hits = moves.filter((m) => m.moveNumber === n && (!color || m.color === color));
    hits.sort((a, b) => (colors.includes(b.color) ? 1 : 0) - (colors.includes(a.color) ? 1 : 0)).forEach((m) => add(m, `move ${n} mentioned`));
  }
  // 2. SAN moves mentioned ("why was Nxe5 bad")
  for (const san of question.match(/\b(?:[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x?[a-h]?[1-8](?:=[QRBN])?|O-O(?:-O)?)[+#]?/g) || []) {
    moves.filter((m) => m.playedMove === san || m.playedMove.replace(/[+#]/, "") === san.replace(/[+#]/, "")).forEach((m) => add(m, `${san} mentioned`));
  }
  // 3. The move selected on the board
  if (selectedPly) add(moves.find((m) => m.ply === selectedPly), "selected on the board");

  // 4. Intent keywords
  if (/lose|lost|turning point|advantage|where did|when did .* go wrong/.test(q)) {
    const worst = [...mine].sort((a, b) => {
      const drop = (m) => { const s = m.color === "w" ? 1 : -1; return winPercent(s * m.evaluationBefore) - winPercent(s * m.evaluationAfter); };
      return drop(b) - drop(a);
    });
    add(worst[0], "largest drop in winning chances");
  }
  if (/blunder|mistake|worst|bad move|wrong/.test(q)) byCpl(mine.filter((m) => SIGNIFICANT.has(m.classification))).slice(0, 3).forEach((m) => add(m, `your ${m.classification}`));
  if (/tactic|missed|combination|fork|pin/.test(q)) mine.filter((m) => m.themes?.some((t) => ["missed_tactic", "missed_fork", "missed_mate", "fork", "hanging_piece"].includes(t))).slice(0, 3).forEach((m) => add(m, "tactical theme"));
  if (/king|safety|mate|attack/.test(q)) mine.filter((m) => m.themes?.some((t) => ["king_safety", "allowed_mate", "missed_mate"].includes(t))).slice(0, 3).forEach((m) => add(m, "king safety theme"));
  if (/opening/.test(q)) byCpl(mine.filter((m) => m.phase === "opening" && SIGNIFICANT.has(m.classification))).slice(0, 2).forEach((m) => add(m, "opening mistake"));
  if (/endgame|ending/.test(q)) byCpl(mine.filter((m) => m.phase === "endgame" && SIGNIFICANT.has(m.classification))).slice(0, 2).forEach((m) => add(m, "endgame mistake"));

  // 5. Default: the player's biggest mistakes
  if (!picked.size) byCpl(mine.filter((m) => SIGNIFICANT.has(m.classification))).slice(0, 3).forEach((m) => add(m, "one of your biggest mistakes"));
  return { moves: [...picked.values()].sort((a, b) => a.ply - b.ply) };
}

// Engine facts in a compact, LLM-friendly and user-displayable form.
export function factsFor(m) {
  return {
    ply: m.ply,
    moveNumber: m.moveNumber,
    color: colorName(m.color),
    played: m.playedMove,
    classification: m.classification,
    evalBefore: formatEval(m.evaluationBefore, m.mateBefore),
    evalAfter: formatEval(m.evaluationAfter, m.mateAfter),
    centipawnLoss: m.centipawnLoss,
    bestMove: m.bestMove,
    line: (m.principalVariation || []).slice(0, 6).join(" "),
    themes: (m.themes || []).map((t) => THEME_LABELS[t] || t),
    fenBefore: m.fenBefore,
    why: m.why,
  };
}

export const factsText = (facts) =>
  facts.length
    ? facts.map((f) =>
      `- Move ${f.moveNumber} (${f.color}) played ${f.played} [${f.classification}]. Stockfish evaluation before ${f.evalBefore}, after ${f.evalAfter} (White's point of view; positive favours White). Centipawn loss ${f.centipawnLoss}. Stockfish preferred ${f.bestMove || "(none)"}${f.line ? `; line: ${f.line}` : ""}.${f.themes.length ? ` Themes: ${f.themes.join(", ")}.` : ""} FEN before: ${f.fenBefore}. (Relevant because: ${f.why})`
    ).join("\n")
    : "(no analysed moves selected)";

export const allowedEvalsOf = (facts) => facts.flatMap((f) => [f.evalBefore, f.evalAfter, String(f.centipawnLoss)]);

export async function gameMetaText(game, userId) {
  const colors = userColors(game);
  const you = game.mode === "local" ? "both sides (local game)" : colors.map(colorName).join(" and ");
  const outcome = game.outcomeFor(userId);
  const sans = game.moves.map((m) => m.san || m.move);
  const moveList = sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${s}` : s)).join(" ");
  return [
    `Mode: ${game.mode}${game.mode === "ai" ? ` vs Stockfish (${game.difficulty})` : ""}. The player (you) played ${you}.`,
    `Result: ${game.result}${game.endReason ? ` by ${game.endReason.replace(/_/g, " ")}` : ""}${outcome ? ` (${outcome} for the player)` : ""}.`,
    game.opening?.name ? `Opening: ${game.opening.name} (${game.opening.eco}).` : null,
    `Date: ${(game.completedAt || game.createdAt)?.toISOString().slice(0, 10)}. Moves: ${game.moves.length} plies.`,
    game.timeControl?.initialMs ? `Time control: ${game.timeControl.initialMs / 60000}+${(game.timeControl.incrementMs || 0) / 1000}.` : null,
    `Move list: ${moveList.length > 1200 ? `${moveList.slice(0, 1200)} …` : moveList}`,
  ].filter(Boolean).join("\n");
}

/**
 * Player history (spec §13 E): recurring themes across the player's other
 * analysed games. Pure database lookups, no vectors needed (spec §60.6).
 */
export async function playerHistory(userId, excludeGameId, { games = 10 } = {}) {
  const recent = await GameSession.find({
    _id: { $ne: excludeGameId },
    analysisStatus: "completed",
    $or: [{ player: userId }, { whitePlayer: userId }, { blackPlayer: userId }],
  }).sort({ completedAt: -1 }).limit(games).select("_id mode playerColor whitePlayer blackPlayer player");
  if (!recent.length) return { games: 0, themes: [], text: "" };
  const analyses = await GameAnalysis.find({ gameSession: { $in: recent.map((g) => g._id) } }).select("gameSession moveAnalysis.color moveAnalysis.themes moveAnalysis.classification").lean();
  const counts = {};
  for (const a of analyses) {
    const g = recent.find((x) => String(x._id) === String(a.gameSession));
    const colors = g.mode === "online" ? [g.colorOf(userId)] : userColors(g);
    const seen = new Set();
    for (const m of a.moveAnalysis) if (colors.includes(m.color)) (m.themes || []).forEach((t) => seen.add(t));
    seen.forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
  }
  const themes = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([theme, n]) => ({ theme, label: THEME_LABELS[theme] || theme, games: n }));
  return {
    games: analyses.length,
    themes,
    text: themes.length
      ? `Across the player's last ${analyses.length} other analysed games: ${themes.map((t) => `${t.label} in ${t.games}`).join("; ")}.`
      : `No recurring themes found in the player's last ${analyses.length} analysed games.`,
  };
}
