# CodeMate REST API

> The HTTP contract implemented by `backend/`. Real-time play is in [../websocket/protocol.md](../websocket/protocol.md) and async events in [../events/kafka-events.md](../events/kafka-events.md).

**Base URL (local):** `http://localhost:5050`. The frontend dev server proxies `/api` and `/socket.io` to it.

## Conventions

### Authentication

Log in or register to get an access token (15 min by default) and a refresh token (7 days). Both are also set as httpOnly cookies: `jwt` and `refreshToken`, `SameSite=Strict`, `Secure` in production. A protected route accepts either:

- `Authorization: Bearer <token>`, or
- the `jwt` cookie (browsers send it automatically on same-origin requests).

When a request returns `401`, call `POST /api/auth/refresh` once, then retry. Refresh tokens rotate: each one can be used only once.

### Response envelope

Success:

```json
{ "success": true, "...": "endpoint fields" }
```

Error (spec §52). `message` is duplicated at the top level for older clients:

```json
{
  "success": false,
  "error": { "code": "GAME_NOT_FOUND", "message": "Game not found", "details": [ { "path": "body.email", "message": "Invalid email address" } ] },
  "message": "Game not found",
  "requestId": "0f6c…"
}
```

`details` is only present for validation errors (`VALIDATION_ERROR`). Every response carries an `x-request-id` header, and you can send your own to correlate logs.

### Pagination

List endpoints take `?page=1&limit=20` (max 100) and return:

```json
{ "success": true, "items": [], "pagination": { "page": 1, "limit": 20, "total": 57, "pages": 3 } }
```

### Rate limits

A `429` response has code `RATE_LIMITED`. Limits are per user, or per IP when anonymous:

| Group | Limit |
| :-- | :-- |
| Auth | 30 requests / 15 min |
| AI | 20 / min |
| Code execution | 10 / min |
| Analysis requests | 6 / min |
| Everything under `/api` | 300 / min |

### Common error codes

| Code | Meaning |
| :-- | :-- |
| `VALIDATION_ERROR` | Invalid request |
| `NO_TOKEN`, `TOKEN_INVALID`, `TOKEN_EXPIRED` | Authentication problem |
| `INVALID_CREDENTIALS` | Wrong email or password |
| `*_NOT_FOUND` | The resource doesn't exist, or you don't own it (both return 404 on purpose) |
| `ILLEGAL_MOVE`, `NOT_YOUR_TURN`, `STALE_POSITION`, `CONCURRENT_MOVE`, `GAME_NOT_ACTIVE` | Move rejected |
| `NO_HINT_CREDITS` | No hints left |
| `EXECUTION_UNAVAILABLE` | Judge0 isn't configured (503) |

---

## Types

```ts
type Color = "w" | "b";
type Difficulty = "beginner" | "intermediate" | "advanced" | "master" | "grandmaster" | "legendary";
type MoveInput = { from: string; to: string; promotion?: "q" | "r" | "b" | "n" } | { san: string } | { uci: string };

interface User {
  _id: string; username: string; email: string;
  chessStats: { gamesPlayed: number; rating: number; peakRating: number; wins: number; losses: number; draws: number };
  codingStats: { problemsSolved: number; submissions: number; accepted: number; preferredLanguage: string };
  hintCredits: number;
  preferences: { boardTheme: "classic" | "green" | "blue" | "wood"; pieceSet: string; defaultDifficulty: Difficulty; showEvaluation: boolean };
  createdAt: string;
}

interface Side { type: "human" | "engine" | "open"; _id?: string; username?: string; rating?: number }

interface Clocks { whiteMs: number; blackMs: number; turn: Color; running: boolean; serverTime: number }

interface Game {
  _id: string; mode: "ai" | "local" | "online";
  status: "waiting" | "in_progress" | "completed" | "abandoned";
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  endReason: null | "checkmate" | "stalemate" | "insufficient_material" | "threefold_repetition" | "fifty_move_rule"
    | "resignation" | "timeout" | "agreement" | "abandonment" | "aborted";
  difficulty: Difficulty | null;
  yourColor: Color | null;            // null in local games (you play both sides)
  white: Side; black: Side;
  initialFen: string; fen: string; turn: Color; ply: number;
  moves: { ply: number; san: string; uci: string; color: Color; fen: string; clockMs?: number }[];  // fen = position AFTER the move
  pgn: string | null; opening: { eco: string; name: string } | null;
  rated: boolean; ratingChange: { white?: number; black?: number } | null;
  timeControl: { initialMs: number; incrementMs: number } | null;
  clocks: Clocks | null; paused: boolean; drawOfferBy: Color | null;
  roomCode?: string;                  // only while waiting
  analysisStatus: "none" | "pending" | "running" | "completed" | "failed";
  hintsUsed: number; createdAt: string; completedAt: string | null;
}

interface MoveAnalysis {
  ply: number; moveNumber: number; color: Color; fenBefore: string; fenAfter: string;
  playedMove: string; playedMoveUci: string; bestMove: string | null; bestMoveUci: string | null;
  evaluationBefore: number; evaluationAfter: number;   // centipawns, WHITE's point of view; ±10000 = mate on board
  mateBefore: number | null; mateAfter: number | null; // mate distance, White's point of view
  centipawnLoss: number; accuracy: number;             // 0-100
  classification: "book" | "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
  principalVariation: string[];                        // SAN, starting from fenBefore
  themes: string[];   // hanging_piece | missed_tactic | fork | missed_fork | allowed_mate | missed_mate | king_safety | endgame_technique | opening_principles | time_management
  phase: "opening" | "middlegame" | "endgame";
}

interface SideStats { accuracy: number | null; averageCentipawnLoss: number | null; counts: Record<MoveAnalysis["classification"], number> }

interface GameAnalysis {
  _id: string; gameSession: string; status: "completed"; engineVersion: string; depth: number;
  white: SideStats; black: SideStats; themes: string[]; moveAnalysis: MoveAnalysis[]; durationMs: number;
  aiStatus: "none" | "pending" | "completed" | "failed" | "skipped";
  aiReport?: { summary: string; strengths: string[]; weaknesses: string[];
    keyMoments: { ply: number; moveNumber: number; playedMove: string; bestMove: string; explanation: string }[];
    trainingRecommendations: string[]; provider: string; model: string | null; generatedAt: string };
}

interface EngineFact {   // shown to users as "Stockfish facts"
  ply: number; moveNumber: number; color: "White" | "Black"; played: string; classification: string;
  evalBefore: string; evalAfter: string;   // formatted, White POV: "+1.35", "-0.40", "M3", "-M2", "#"
  centipawnLoss: number; bestMove: string | null; line: string; themes: string[]; fenBefore: string; why: string;
}

interface Source { title: string; section: string; source: string }  // source = corpus path, e.g. "tactics/pin.md"

interface AiAnswer {
  answer: string;                // Markdown
  keyConcepts: string[]; recommendations: string[]; sources: Source[];
  route: "game" | "chess" | "mixed";
  provider: string;              // "none" = deterministic fallback, no LLM
  model: string | null;
  degraded: boolean;             // true when the fallback answered
  facts?: EngineFact[];          // game chat only
  groundingWarnings?: string[];  // evaluations the LLM invented (its answer was discarded)
}
```

---

## Auth: `/api/auth`

| Method | Path | Body | Response |
| :-- | :-- | :-- | :-- |
| POST | `/register` | `{ username (3-30, [A-Za-z0-9_.-]), email, password (8+), confirmPassword }` | `201 { user, token, refreshToken, _id, username, email }` |
| POST | `/login` | `{ email, password }` | `200 { user, token, refreshToken, ... }`; `401 INVALID_CREDENTIALS` |
| POST | `/refresh` | `{ refreshToken? }` (or the cookie) | `200 { accessToken, token, refreshToken }` |
| POST | `/logout` | `{ refreshToken? }` (or the cookie) | `200`, and clears the cookies |
| GET | `/me` | — | `200 { user }` |

## Users: `/api/users`

| Method | Path | Notes |
| :-- | :-- | :-- |
| GET | `/me` | `{ user }` |
| PATCH | `/me` | `{ username?, preferences?: {...}, preferredLanguage?: "javascript" \| "python" \| "java" \| "cpp" }` returns `{ user }` |
| GET | `/me/statistics` | `{ chess: ChessStats, coding: CodingStats }` (same shapes as the dashboard) |
| GET | `/me/rating-history` | `{ current, history: [{ before, after, delta, opponentRating, score, game, createdAt }] }` |
| GET | `/:id` | Public profile: `{ user: { _id, username, rating, chessStats, codingStats: { problemsSolved } } }` |

## Meta

`GET /api/meta` (public) returns `{ difficulties: [{ key, elo }], timeControls: [{ key: "5+0", initialMs, incrementMs, label }] }`

`GET /api/ai/status` returns `{ provider: "none" | "groq" | "nvidia" | "gemini", enabled }`

## Games: `/api/games`

| Method | Path | Body / query | Response |
| :-- | :-- | :-- | :-- |
| POST | `/` | `{ mode: "ai" \| "local", color?: "white" \| "black" \| "random", difficulty?, rated?, timeControl?: { initialMs, incrementMs } }` | `201 { game }`. If you play black against the engine, it has already made its first move. |
| GET | `/` | `?page&limit&mode&status` | Paginated summaries: `{ _id, mode, status, result, endReason, difficulty, yourColor, outcome: "win" \| "loss" \| "draw" \| null, opponent, plies, opening, rated, ratingChange, analysisStatus, createdAt, completedAt }` |
| GET | `/:id` | — | `{ game }` |
| POST | `/:id/moves` | `{ move: MoveInput, expectedPly? }` | `{ move, reply, outcome, game }`. In AI games, `reply` is the engine's answer. `outcome` is `{ result, reason }` or null. |
| POST | `/:id/bot-move` | — | Asks the engine to move when it's its turn |
| POST | `/:id/resign` | — | `{ game }`. In local games the side to move resigns. |
| POST | `/:id/abort` | — | Only before the second move: `{ game }` with status `abandoned` |
| POST | `/:id/draw` | — | Local games only: draw by agreement |
| POST | `/:id/hint` | — | AI games, your turn, costs 1 hint credit: `{ bestMove: { san, uci, from, to }, score, hintCredits }` |
| GET | `/:id/pgn` | — | `application/x-chess-pgn` download |

### Analysis (Stockfish)

| Method | Path | Response |
| :-- | :-- | :-- |
| POST | `/api/games/:id/analyze` | `202 { status: "pending" }`, or `200 { status: "completed" }`. The game must be finished. Finished games with 6+ plies are analysed automatically. |
| GET | `/api/games/:id/analysis` | `{ status, aiStatus, analysis: GameAnalysis \| null }`. Poll this, or listen for the `analysis:update` socket event. |

### AI about this game (Game Analysis RAG)

| Method | Path | Body | Response |
| :-- | :-- | :-- | :-- |
| POST | `/api/games/:id/chat` | `{ message, selectedPly? }` | `AiAnswer` (with `facts`) |
| GET | `/api/games/:id/chat` | — | `{ messages: [{ role, content, ply?, route?, sources?, facts?, keyConcepts?, degraded?, createdAt }] }` |
| DELETE | `/api/games/:id/chat` | — | Clears the conversation |
| POST | `/api/games/:id/moves/:ply/explain` | — | `{ move: EngineFact, explanation: { whatHappened, whyItMatters, betterMove, concept, lookFor, keyConcepts }, sources, canPractice, provider, degraded }` |
| POST | `/api/games/:id/mistakes/:ply/practice` | — | `201 { puzzle }` (idempotent) |

## Puzzles: `/api/puzzles`

`Puzzle = { _id, fen, sideToMove, theme, themes, difficulty: "easy" | "medium" | "hard", sourceGame, sourceMoveNumber, playedMove, attempts, solved, expectedSan?, expectedMove? }`. The answer is included only once the puzzle is solved or revealed.

| Method | Path | Notes |
| :-- | :-- | :-- |
| GET | `/` | `?solved=true\|false&theme&page&limit`, paginated |
| GET | `/next` | `?theme`: the next unsolved puzzle, `{ puzzle \| null }` |
| GET | `/:id` | `{ puzzle }` |
| POST | `/:id/attempt` | `{ move: MoveInput }` returns `{ correct, played: { san, uci }, expected (after a correct answer or 3 attempts), evaluation, attempts, puzzle }`. Another move counts as correct if Stockfish rates it within 30 cp of the answer. |
| POST | `/:id/reveal` | `{ puzzle }`, including the answer |

## Chess knowledge (general RAG): `/api/chess`

| Method | Path | Body | Response |
| :-- | :-- | :-- | :-- |
| POST | `/chat` | `{ message }` | `AiAnswer` (`route: "chess"`) |
| GET | `/chat` | — | `{ messages }` |
| DELETE | `/chat` | — | Clears the conversation |
| GET | `/knowledge/search?q=&limit=` | — | Retrieval only, no LLM: `{ results: [{ title, section, source, topic, subcategory, difficulty, text, score }], appliedTopic }` |

## Coach: `/api/coach`

| Method | Path | Response |
| :-- | :-- | :-- |
| GET | `/report` | `{ report }`. If `report.enoughData === false`: `{ gamesAnalyzed, minimumGames: 3, message }`. Otherwise: `{ gamesAnalyzed, movesAnalyzed, accuracy, averageCentipawnLoss, classifications, phases: [{ phase, moves, averageCentipawnLoss, mistakesPer100 }], categories: [{ key, label, mistakes, per100Moves, trend: "improving" \| "stable" \| "needs_attention" \| "not_enough_data" }], recurringMistakes: [{ theme, label, games, share, example: { gameId, ply, moveNumber, playedMove, bestMove } }], openings: [{ name, games, wins, draws, losses, score, accuracy }], timeManagement, puzzles: [{ theme, label, total, solved }], ratingHistory, strengths: [{ category, text }], weaknesses: [{ category, text }], recommendedConcepts: [{ source, title }], recommendedPuzzles: [{ _id, theme, difficulty }], trainingPlan: [{ step, type, text, source? }] }` |
| POST | `/summary` | `{ report, narrative: { answer, keyConcepts, recommendations, provider, degraded } }` |
| POST | `/chat` | `{ message }` returns `{ answer, keyConcepts, recommendations, provider, degraded }` |
| GET | `/chat` | `{ messages }` |

## Coding: `/api/coding`

| Method | Path | Notes |
| :-- | :-- | :-- |
| GET | `/languages` | `{ languages: [{ key, name }], executionAvailable }` |
| GET | `/tags` | `{ tags }` |
| GET | `/problems` | `?difficulty&tag&search&page&limit`: items `{ _id, title, slug, difficulty, tags, mode, solved }` |
| GET | `/problems/:idOrSlug` | `{ problem: { _id, title, slug, statement, inputFormat, outputFormat, constraints, difficulty, tags, mode: "stdio" \| "function", starterCode: { [language]: string }, samples: [{ input, output }], timeLimitSec, memoryLimitKb, solved } }`. Hidden tests are never sent. |
| POST | `/submissions` | `{ problemId (id or slug), language, code, kind: "run" \| "submit" }` returns `202 { submission }`. `run` = samples only. |
| GET | `/submissions` | `?problemId&status&page&limit`: items without code or test results |
| GET | `/submissions/:id` | `{ submission: { _id, problem: { title, slug, difficulty }, language, kind, status, passedCount, totalCount, score, executionTime, memory, compileOutput, testResults: [{ index, hidden, input?, expected?, output?, status, passed, time, memory, error? }], firstAccept, code, createdAt, completedAt } }` |

Submission `status` is one of `queued`, `running`, `accepted`, `wrong_answer`, `compilation_error`, `runtime_error`, `time_limit_exceeded`, `memory_limit_exceeded`, `internal_error` or `unavailable`. Poll until it's no longer `queued` or `running`, or listen for `submission:update`. A problem's first accepted submit earns **one hint credit** (up to 5).

## Dashboard and leaderboard

`GET /api/dashboard` returns:

```ts
{
  chess: { rating, peakRating, games, wins, losses, draws, winRate, gamesAnalyzed, accuracy, averageCentipawnLoss,
           mistakeDistribution: Record<classification, number>, phaseCpl: Record<phase, number>,
           themes: [{ theme, label, count }], openings: [{ name, eco, games, wins, draws, losses }],
           ratingHistory: [{ at, rating, delta }] },
  coding: { problemsSolved, submissions, accepted, acceptanceRate, languages: [{ language, submissions, accepted }],
            difficulty: Record<difficulty, number>, statuses, recentSubmissions, hintCredits },
  ai: { gamesAnalyzed, analysisPending, questions, topConcepts: [{ concept, count }], recommendations: [{ theme, text }] },
  learning: { puzzles, puzzlesSolved },
  recentGames: [{ _id, mode, status, result, outcome, difficulty, opening, createdAt, analysisStatus, plies, endReason }],
  generatedAt
}
```

This is cached for up to 60 s and refreshed when your games, analyses or submissions change.

`GET /api/leaderboard?period=all|month` returns `{ period, rows: [{ rank, userId, username, rating, games, problemsSolved? , gained? }] }`

## Operations

| Path | Purpose |
| :-- | :-- |
| `GET /health` | Liveness: `{ status: "ok", role, uptime }` |
| `GET /ready` | Readiness: Mongo and KV checks, plus `backends: { kv, events, vector, llm }`; 503 when not ready |
| `GET /metrics` | Prometheus metrics (when `METRICS_ENABLED`) |

## Admin

| Method | Path | Guard |
| :-- | :-- | :-- |
| POST | `/api/admin/login` | — (returns an admin token, `typ: "admin"`) |
| POST | `/api/admin/add-admin` | superadmin. Seed the first one with `npm run seed:admin`. |
| POST | `/api/coding-questions/add-question` | admin. `mode` defaults to `stdio`. |
| GET | `/api/coding-questions` | admin (list, without hidden tests) |
| GET | `/api/coding-questions/get-a-question?difficulty=` | admin (random pick; the old body parameter still works) |
| PATCH / DELETE | `/api/coding-questions/:id` | admin |

## Legacy endpoints (deprecated, still working)

These kept their pre-Phase-0 URLs and response fields, but now run through the same authoritative services.

| Endpoint | Behaviour now |
| :-- | :-- |
| `POST /api/game/start` `{ opponent, difficulty? }` | Same as `POST /api/games` |
| `POST /api/game/save` `{ gameId, move, fen? }` | Validates `move`; the client's `fen` is ignored |
| `POST /api/game/end` `{ gameId, status }` | `lost` = resign. `abandoned` = abort, or resign after move 1. `won`/`draw` only if the board already shows that result (otherwise `409 GAME_NOT_OVER`). |
| `POST /api/game/bot-move` `{ gameId }` | Engine move |
| `POST /api/game-analysis/analyze` `{ gameId }` | Synchronous analysis; returns the `GameAnalysis` document |
| `GET /api/game-analysis/:gameId` | The stored analysis |
| `POST /api/code/execute` `{ code, language, questionId }` | Synchronous; hidden test data is no longer returned |

These behaviours changed since the audit:

- Invalid login returns **401**, not 400.
- Passwords need at least **8** characters.
- `GET /test` became `POST /test`, and exists only when `ENABLE_DEBUG_ROUTES=true`.
