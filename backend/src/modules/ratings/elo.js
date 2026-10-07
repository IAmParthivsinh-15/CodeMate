// Standard Elo (spec §36): isolated, deterministic, no I/O.

export const expectedScore = (rating, opponentRating) => 1 / (1 + 10 ** ((opponentRating - rating) / 400));

// K=40 while a player is provisional (< 30 games), 20 afterwards, 10 at 2400+.
export function kFactor(rating, gamesPlayed) {
  if (gamesPlayed < 30) return 40;
  if (rating >= 2400) return 10;
  return 20;
}

/**
 * @param {number} rating
 * @param {number} opponentRating
 * @param {0|0.5|1} score
 * @param {number} gamesPlayed games completed BEFORE this one
 */
export function ratingDelta(rating, opponentRating, score, gamesPlayed) {
  return Math.round(kFactor(rating, gamesPlayed) * (score - expectedScore(rating, opponentRating)));
}

export const RATING_FLOOR = 100;
export const applyDelta = (rating, delta) => Math.max(RATING_FLOOR, rating + delta);
