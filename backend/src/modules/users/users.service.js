// Shape of a user as seen by clients. Never includes password, refresh tokens
// or the legacy embedded submissions array.
export const publicUser = (u) => ({
  _id: u._id,
  username: u.username,
  email: u.email,
  chessStats: u.chessStats,
  codingStats: u.codingStats,
  hintCredits: u.hintCredits ?? 0,
  preferences: u.preferences,
  createdAt: u.createdAt,
});

// What other players may see (no email).
export const opponentView = (u) =>
  u ? { _id: u._id, username: u.username, rating: u.chessStats?.rating ?? 800 } : null;
