// Pure UCI output parsing: no process, so it is unit-testable.

// "info depth 12 seldepth 18 multipv 1 score cp -34 nodes ... pv e7e5 g1f3"
export function parseInfoLine(line) {
  if (!line.startsWith("info ") || !line.includes(" score ")) return null;
  if (line.includes(" lowerbound") || line.includes(" upperbound")) return null; // aspiration-window partials
  const depth = Number(line.match(/ depth (\d+)/)?.[1]);
  const multipv = Number(line.match(/ multipv (\d+)/)?.[1] || 1);
  const score = line.match(/ score (cp|mate) (-?\d+)/);
  if (!score || Number.isNaN(depth)) return null;
  const pv = line.match(/ pv (.+)$/)?.[1].trim().split(/\s+/) || [];
  return { depth, multipv, score: { type: score[1], value: Number(score[2]) }, pv };
}

// "bestmove e2e4 ponder e7e5" | "bestmove (none)"
export function parseBestMove(line) {
  const m = line.match(/^bestmove (\S+)(?: ponder (\S+))?/);
  if (!m) return undefined;
  return { bestMove: m[1] === "(none)" ? null : m[1], ponder: m[2] || null };
}

// Mate scores become large centipawn values so they can be compared and
// averaged; ±10000 minus distance keeps "mate in 2" better than "mate in 5".
export const MATE_CP = 10000;
export function scoreToCp(score) {
  if (!score) return 0;
  if (score.type === "cp") return score.value;
  if (score.value === 0) return -MATE_CP; // side to move is mated
  return Math.sign(score.value) * (MATE_CP - Math.abs(score.value) * 10);
}

// Engine scores are from the side-to-move's point of view; analysis stores
// White's point of view so a whole game can be plotted on one axis.
export const toWhitePov = (score, sideToMove) =>
  sideToMove === "w" ? score : { type: score.type, value: -score.value };
