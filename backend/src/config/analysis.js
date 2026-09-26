// Move-classification thresholds live here and nowhere else (spec §12).
// Bump THRESHOLDS_VERSION whenever they change so stored analyses can be
// recognised as stale and re-run.
export const THRESHOLDS_VERSION = 1;

export const ANALYSIS_THRESHOLDS = Object.freeze({
  // Drop in the mover's win probability (percentage points, 0-100 scale).
  // Equivalent to lichess's 0.1 / 0.2 / 0.3 winning-chances deltas.
  winDrop: { inaccuracy: 5, mistake: 10, blunder: 15 },
  // Moves below the inaccuracy line are "excellent" up to this centipawn loss, else "good".
  cpl: { excellent: 10 },
  // Evaluations are clamped to ±CPL_CLAMP before averaging CPL, so a missed
  // mate in an already-won position doesn't dominate the game's average.
  cplClamp: 1000,
  // A position counts as an endgame when total non-pawn material
  // (Q=9, R=5, B=N=3, both sides) is at or below this.
  endgameMaterial: 20,
  // Plies considered "opening" for phase statistics.
  openingPlies: 20,
  // Minimum centipawn loss before a theme is attached to a move.
  themeMinCpl: 100,
});

// Win probability (0-100) for a centipawn score from the mover's point of view.
export const winPercent = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

// Per-move accuracy from win-probability drop (lichess formula), 0-100.
export const moveAccuracy = (winBefore, winAfter) =>
  Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, winBefore - winAfter)) - 3.1669));

/**
 * @param {{isBest:boolean, isBook:boolean, cpl:number, winDrop:number}} m
 */
export function classifyMove({ isBest, isBook, cpl, winDrop }, t = ANALYSIS_THRESHOLDS) {
  if (winDrop >= t.winDrop.blunder) return "blunder";
  if (winDrop >= t.winDrop.mistake) return "mistake";
  if (winDrop >= t.winDrop.inaccuracy) return "inaccuracy";
  if (isBook) return "book";
  if (isBest) return "best";
  if (cpl <= t.cpl.excellent) return "excellent";
  // Anything else that didn't cost real winning chances (e.g. cpl > good in
  // an already-decided position) is still "good".
  return "good";
}

export const SIGNIFICANT = new Set(["inaccuracy", "mistake", "blunder"]);

// Theme → Chess Knowledge corpus documents (ai/corpus/chess-knowledge/…),
// used to pull relevant teaching material into game explanations.
export const THEME_KNOWLEDGE = Object.freeze({
  hanging_piece: ["tactics/hanging_pieces.md", "middlegame/calculation.md"],
  missed_tactic: ["middlegame/calculation.md", "tactics/double_attack.md"],
  fork: ["tactics/fork.md"],
  missed_fork: ["tactics/fork.md"],
  allowed_mate: ["tactics/checkmate_patterns.md", "strategy/king_safety.md"],
  missed_mate: ["tactics/checkmate_patterns.md", "middlegame/attacking_the_king.md"],
  king_safety: ["strategy/king_safety.md"],
  endgame_technique: ["endgames/endgame_principles.md"],
  opening_principles: ["openings/opening_principles.md"],
  time_management: ["middlegame/time_management.md"],
});

export const THEME_LABELS = Object.freeze({
  hanging_piece: "Hanging piece",
  missed_tactic: "Missed tactic",
  fork: "Allowed a fork",
  missed_fork: "Missed a fork",
  allowed_mate: "Allowed mate",
  missed_mate: "Missed mate",
  king_safety: "King safety",
  endgame_technique: "Endgame technique",
  opening_principles: "Opening principles",
  time_management: "Time management",
});
