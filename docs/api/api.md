# CodeMate API Reference (current)

> Describes the API **as implemented** on 2026-09-26. Known defects are flagged inline and detailed in [gap-analysis.md](../architecture/gap-analysis.md). Endpoints planned in [phase-0-1-plan.md](../architecture/phase-0-1-plan.md) are not listed until they exist.

**Base URL (local):** `http://localhost:<PORT>` (the Kubernetes manifests use `5050`)

## Authentication

Protected routes accept either of these:

- `Authorization: Bearer <accessToken>` header
- the `jwt` httpOnly cookie, set by the login and register responses

Access tokens last 15 minutes by default (`ACCESS_TOKEN_EXPIRES_IN`). Use `POST /api/auth/refresh` to get a new one.

| Guard | Meaning |
| :-- | :-- |
| — | Public |
| user | `protectRoutes`: a valid token for a document in the `users` collection |
| admin | `protectAdminRoutes`: a valid token for a document in the `admins` collection |
| superadmin | admin **and** `role === "superadmin"` |

## Error format

This is not consistent yet (standardising it is Phase 0 step P0.4). Most errors look like this:

```json
{ "message": "Human-readable reason" }
```

---

## Auth: `/api/auth`

| Method | Path | Guard | Body | Success |
| :-- | :-- | :-- | :-- | :-- |
| POST | `/register` | — | `{ username, email, password, confirmPassword }` | `201 { _id, username, email, token, refreshToken, message }` + cookies |
| POST | `/login` | — | `{ email, password }` | `200 { _id, username, email, token, refreshToken, message }` + cookies |
| POST | `/refresh` | — | `{ refreshToken }` | `200 { accessToken, refreshToken }` (the old refresh token is revoked) |
| POST | `/logout` | — | `{ refreshToken }` | `200 { message }` |
| GET | `/me` | user | — | `200 { _id, username, email, message }` |

Invalid login credentials return **400**, not 401.

## Admin: `/api/admin`

| Method | Path | Guard | Body | Success |
| :-- | :-- | :-- | :-- | :-- |
| POST | `/login` | — | `{ email, password }` | `200 { _id, username, email, role, token, refreshToken }` |
| POST | `/add-admin` | superadmin | `{ username, email, password, role? }` | `201 { message, admin }` |

There is no endpoint that creates the first superadmin; it has to be inserted into MongoDB by hand.

## Games: `/api/game`

| Method | Path | Guard | Body | Success |
| :-- | :-- | :-- | :-- | :-- |
| POST | `/start` | user | `{ opponent: "computer" \| "human", difficulty? }` | `201 { message, gameId, currentFEN, game }` |
| POST | `/save` | user | `{ gameId, move, fen }` | `200 { message, gameId, currentFEN, moves }` |
| POST | `/end` | user | `{ gameId, status: "won" \| "lost" \| "draw" \| "abandoned" }` | `200 { message, gameId, status, currentFEN, moves }` |

`difficulty` is one of `beginner | intermediate | advanced | master | grandmaster | legendary`.

> ⚠️ `save` and `end` don't check that the game belongs to the caller, and they accept `move`, `fen` and `status` from the client without validation.

## Game analysis: `/api/game-analysis`

| Method | Path | Guard | Body | Success |
| :-- | :-- | :-- | :-- | :-- |
| POST | `/analyze` | user | `{ gameId }` | `200 GameAnalysis` (returns the cached analysis if one already exists) |

> 🔴 Currently returns **500**: the handler loses its `this` binding (gap analysis §3.5).

## Coding questions: `/api/coding-questions`

| Method | Path | Guard | Body | Success |
| :-- | :-- | :-- | :-- | :-- |
| POST | `/add-question` | admin | `{ title, slug, statement, inputFormat, outputFormat, constraints, samples[], testcases[], difficulty, tags? }` | `201 { message, question }` |
| GET | `/get-a-question` | admin | `{ difficulty }` **in the request body** | `200 { message, question }`: a random question of that difficulty |

## Code execution: `/api/code`

| Method | Path | Guard | Body | Success |
| :-- | :-- | :-- | :-- | :-- |
| POST | `/execute` | user | `{ code, language: "javascript" \| "python" \| "java" \| "cpp", questionId }` | `200 { message, question, execution: { samples, testCases, score, passed, language, timeTaken } }` |

Hidden test cases run only if every sample passes. The submission is saved to `User.submissions`.

> ⚠️ User code must define `solve(n, arr)`. Hidden test cases' `expected` values are returned to the client.

## Misc

| Method | Path | Guard | Notes |
| :-- | :-- | :-- | :-- |
| GET | `/` | — | Returns the text `Welcome to the Chess Game API` |
| GET | `/test` | — | Debug: `{ fen, level? }` in the **body**, returns `{ bestMove }`. Unauthenticated, and starts a new Stockfish process per call. Scheduled for removal in P0.6 #5. |
