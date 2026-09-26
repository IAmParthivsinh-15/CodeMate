# CodeMate — Gap Analysis (Phase 0 audit)

> **Date:** 2026-09-26
> **Compared against:** [ENHANCEMENT.md](../../ENHANCEMENT.md)
> **Branch:** `restructure/phase-0`
> **Next step:** [Phase 0 + Phase 1 file-level plan](./phase-0-1-plan.md)

This document records what the repository contained when the audit ran, measured against the enhancement specification. Every "Broken" item was confirmed by reading the code. Items that were also checked by running code are marked **(verified)**.

## How to read the status column

| Status | Meaning |
| :-- | :-- |
| ✅ Works | Implemented and behaves correctly for its current purpose. |
| 🟡 Partial | Exists, but is missing parts the spec requires, or has defects that limit it. |
| 🔴 Broken | Exists, but fails at runtime or is unsafe. |
| ⬜ Missing | Not present at all. |

---

## 1. Summary

| Area | Status | One-line verdict |
| :-- | :-- | :-- |
| User auth (register / login / refresh / logout / me) | ✅ Works | Functional, with hardening gaps (see §3.1). |
| Admin auth + add admin | 🟡 Partial | Works, but there is no way to create the first superadmin. |
| Game sessions (start / save / end) | 🔴 Broken (security) | No ownership checks; the client decides moves, FEN and result. |
| Bot moves (AI opponent) | 🔴 Broken | `getMoveForBot` exists but no route calls it. The only engine route is an unauthenticated debug `GET /test`. |
| Game history / replay | ⬜ Missing | No list or get-by-id endpoint. |
| Stockfish analysis | 🔴 Broken | `POST /api/game-analysis/analyze` throws because of an unbound `this`. The engine logic also has concurrency and scoring defects. |
| Gemini game report | 🟡 Partial | Hard-coded model name, prompt inline in code, key read when the module is imported. |
| Coding questions | 🟡 Partial | Admin-only. Normal users cannot list or fetch problems. |
| Code execution (Judge0) | 🟡 Partial | Only works for one problem shape. Leaks hidden test answers. |
| Frontend | ⬜ Missing | Unmodified Vite + React 19 + TypeScript template. |
| WebSockets / P2P | ⬜ Missing | — |
| Redis, Kafka, workers | ⬜ Missing | — |
| RAG / vector DB / LLM gateway | ⬜ Missing | — |
| Tests | ⬜ Missing | `npm test` exits with an error on purpose. |
| Env validation, structured logging, consistent errors | ⬜ Missing | — |
| Docker | 🟡 Partial | Builds on Node 18 (end of life). Before this branch, it copied `.env` into the image. |
| Kubernetes | 🟡 Partial | Manifests exist. Volume mount path doesn't match the app's working directory. |
| Docs, CI, docker-compose | ⬜ Missing | This branch starts `docs/`. |

---

## 2. Implementation map

`Feature → File → API → Model → Dependencies → Enhancement required`. File paths are the **new** paths after this branch's restructure.

| Feature | File(s) | API | Model | Deps | Enhancement required (phase) |
| :-- | :-- | :-- | :-- | :-- | :-- |
| User auth | `modules/auth/auth.controller.js`, `auth.routes.js`, `tokens.js` | `POST /api/auth/{register,login,logout,refresh}`, `GET /api/auth/me` | `User` | bcrypt, jsonwebtoken, cookie-parser | Validation, rate limit, consistent errors, cookie/expiry fix (P0). Frontend login/register (P1). |
| Auth middleware | `middleware/auth.js`, `middleware/checkRole.js` | — | `User`, `Admin` | jsonwebtoken | Separate the admin token audience/secret (P0). |
| Admin | `modules/admin/*` | `POST /api/admin/login`, `POST /api/admin/add-admin` | `Admin` | bcrypt | Seed script for the first superadmin (P0). |
| Game session | `modules/games/game.controller.js`, `game.routes.js`, `gameSession.model.js` | `POST /api/game/{start,save,end}` | `GameSession` | chess.js (installed, unused here) | Server-side move validation, ownership checks, PGN, history endpoints (P0 for security, P2–P3 for features). |
| Bot move | `modules/games/game.controller.js#getMoveForBot`, `modules/chess/engine.controller.js` | *(unrouted)*, `GET /test` | `GameSession` | Stockfish binary | Route and authenticate the bot move; remove or protect `/test` (P0). |
| Stockfish wrapper | `infrastructure/stockfish/chessEngine.js` | — | — | `backend/engine/stockfish{,.exe}` | Serialise UCI commands, handle mate scores, configurable path (P0). Structured analysis (P6). |
| Game analysis | `modules/analysis/*` | `POST /api/game-analysis/analyze` | `GameAnalysis` | chess.js, Stockfish, Gemini | Fix the crash (P0). Centipawn-loss classification with configurable thresholds (P6). Async worker (P10). |
| AI report | `infrastructure/llm/geminiService.js` | — | embedded in `GameAnalysis.geminiReport` | @google/generative-ai | Model name from env, prompts to `ai/prompts/`, LLM gateway (P9). |
| Coding problems | `modules/coding/codingQuestion.*` | `POST /api/coding-questions/add-question`, `GET /api/coding-questions/get-a-question` | `CodingQuestion` | — | Public list/detail endpoints for users (P1/P11). |
| Code execution | `modules/coding/codeExecution.*`, `infrastructure/judge0/codeExecutor.js` | `POST /api/code/execute` | `User.submissions` (embedded) | axios, Judge0 (RapidAPI) | Stop leaking hidden answers (P0). Stdin/stdout harness, separate `Submission` collection, async worker (P11). |
| DB connection | `infrastructure/mongodb/connection.js` | — | — | mongoose | Remove deprecated options, env validation (P0). |
| Frontend | `frontend/src/*` (template) | — | — | react, vite | Everything in spec §8 (P1). |

---

## 3. Findings by module

### 3.1 Authentication (`modules/auth`, `modules/users`)

- **Works:** register, login, refresh-token rotation, logout, `GET /me`.
- The access-token cookie `maxAge` is hard-coded to 15 minutes, even when `ACCESS_TOKEN_EXPIRES_IN` sets a different JWT lifetime (`tokens.js`).
- The refresh cookie `maxAge` is hard-coded to 7 days. `REFRESH_TOKEN_EXPIRES_IN` in the Kubernetes secret is set separately.
- `register` logs the whole user document, including the password hash: `console.log("User saved to database:", newUser)`.
- The schema's `password.minlength: 6` is checked against the **hash**, so it never rejects a short password.
- Refresh tokens are stored in plain text and expired ones are never removed, so the array grows forever.
- There is no input validation (email format, username length) and no rate limiting.

### 3.2 Admin (`modules/admin`)

- `add-admin` requires an existing superadmin, and there is no seed script. The first superadmin has to be inserted into MongoDB by hand.
- Admin and user JWTs are signed with the same `ACCESS_TOKEN_SECRET` and carry the same payload (`{ userId }`). They are only told apart by which collection the id is found in.
- `addAdmin` logs the whole `req.user`.

### 3.3 Games (`modules/games`)

- 🔴 **No ownership checks.** `save` and `end` call `findByIdAndUpdate(gameId, …)` without filtering by `player`, so any logged-in user can change any game.
- 🔴 **The client is fully trusted.** `move`, `fen` and the final `status` all come from the request body, and chess.js is never used to validate them. `end` also updates win/loss stats from the client-supplied `status`. Spec §10 and §38 forbid this.
- `endedAt` isn't in the schema, so Mongoose strict mode silently drops it.
- `chessStats.gamesPlayed` and `rating` are never updated.
- If the `gameId` is unknown, `save` and `end` crash with a `TypeError` and return 500 instead of 404.
- There is no endpoint to list games or fetch one game, so replay is impossible.
- `getMoveForBot` is written but **not routed**. It also records the bot's move against the *incoming* FEN rather than the resulting FEN.

### 3.4 Chess engine (`infrastructure/stockfish`, `modules/chess`)

- **(verified)** The engine binary resolves from `backend/engine/` and returns a best move.
- The binary path depends on `process.cwd()`, so the server must be started from `backend/`.
- `GET /test` is unauthenticated, reads `req.body` on a GET request, and starts a new Stockfish process on every call. That is an easy way to exhaust CPU.
- `analyzePosition` runs `getBestMove` and `getPositionEvaluation` **at the same time on one UCI process**. Both send `ucinewgame` / `position` / `go`, so the engine's replies get mixed up.
- `getPositionEvaluation` only understands `score cp`. In a forced-mate position (`score mate N`) it times out after 10 s and rejects.
- It resolves on the **first** `info depth … score cp` line, which comes from a shallow depth, not the requested depth.
- Every line of engine output goes to `console.log`, which floods the logs.

### 3.5 Analysis (`modules/analysis`)

- 🔴 **`POST /api/game-analysis/analyze` crashes.** The router passes `gameAnalysisController.analyzeGame` as a bare function, so `this` is `undefined` inside the class method, and `this.analyzeGameSession(...)` throws. The client gets a 500.
- `getAnalysis` and `deleteAnalysis` are not routed. `deleteAnalysis` calls `document.remove()`, which was removed in Mongoose 7, and filters on `'gameSession.player'`, which is not a field.
- `analyzeGameSession` creates `new ChessEngine(...)`, which already starts the engine, then calls `initializeEngine()` again. That leaks one Stockfish process per analysis.
- "Accuracy" is computed from `abs(evaluation)` of the position *before* the move, not from centipawn loss. Evaluations are relative to the side to move and are not normalised. Classification thresholds (90/75/50/25) are hard-coded, while spec §12 requires them to be configurable.
- `isPlayerMove` for human games compares `game.player === game.userId`. `userId` doesn't exist, so the result is always `false`.
- `playerMove === bestMove` only matches when the client stored moves in UCI notation (`e2e4`), because Stockfish returns UCI.

### 3.6 AI (`infrastructure/llm`)

- The model name `"gemini-pro"` is hard-coded. That is an old model id and may no longer be served; the configured model needs checking.
- The prompt is an inline template string. Spec §58 wants prompts in `ai/prompts/`.
- The client is created when the module is imported, so `GEMINI_API_KEY` must already be loaded by then. This used to work only because `config/db.js` happened to be imported first; `server.js` now loads `dotenv/config` before anything else.
- On any error it silently returns a placeholder report, with no status the frontend could show.

### 3.7 Coding (`modules/coding`, `infrastructure/judge0`)

- `GET /api/coding-questions/get-a-question` is **admin-only** and reads `difficulty` from the body of a GET request. Normal users cannot fetch a problem, so the "solve to earn a hint" loop can't work.
- 🔴 **Hidden test answers leak.** `isHidden` is never set, so each hidden test case's `output` and `expected` values are returned to the client.
- The language wrappers hard-code a `solve(n, arr)` signature and a two-line input format, so only problems of that exact shape can be judged.
- Test cases run one after another, each polling Judge0 every 500 ms. That is slow for problems with many test cases.
- `timeTaken` uses `req.startTime`, which is never set, so the value is `NaN` (serialised as `null`).
- The response returns `question.description`, but the schema field is `statement`.
- Submissions are embedded in the `User` document. They grow without limit, and a MongoDB document can't exceed 16 MB.
- The RapidAPI host header is hard-coded, so a self-hosted Judge0 won't work without a code change.

### 3.8 Configuration, dependencies and tooling

- Variables used in code: `PORT, MONGO_URL, ACCESS_TOKEN_SECRET, ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_SECRET, REFRESH_TOKEN_EXPIRES_IN, JUDGE0_API_URL, JUDGE0_API_KEY, GEMINI_API_KEY, NODE_ENV`. `JUDGE0_APP` and `REQ_URL` appear in the Kubernetes deployment but are **never read**.
- Unused dependencies: `bcryptjs` (only `bcrypt` is imported), `mongodb` (Mongoose brings its own driver), `stockfish` (the native binary is used instead), and `crypto` (an npm placeholder package; `import "crypto"` resolves to Node's built-in module).
- `nodemon` is in `dependencies` instead of `devDependencies`. `@types/*` packages are installed, but the project is JavaScript.
- `mongoose.connect` passes `useNewUrlParser` / `useUnifiedTopology`, which do nothing and log deprecation warnings **(verified)**.
- There is no lint config and there are no tests in the backend.
- Error bodies mix `{ message }`, `{ error }`, and `{ message, error }`.
- CORS is fully open (`cors()` with no options). There are no security headers and no rate limiting.

### 3.9 Docker and Kubernetes

- 🔴 **Before this branch, `.dockerignore` did not exclude `.env`.** `COPY . .` would have put the local `.env` (MongoDB credentials, JWT secrets, Judge0 and Gemini keys) inside any image built from this folder. The deployment pulls `parthivsinhv/codemate-backend:latest` from Docker Hub. **If that image was ever pushed, treat those credentials as exposed and rotate them.** Fixed on this branch.
- `infrastructure/kubernetes/secret.yaml` holds real credentials locally. It was **never committed** (checked with `git log --all`) and stays gitignored.
- The Dockerfile uses `node:18` (end of life) and `WORKDIR /`, so the app runs from the filesystem root.
- `deployment.yaml` mounts an empty `emptyDir` volume at `/usr/src/app/engine`. The app actually lives at `/`, so the mount does nothing today. If `WORKDIR` is changed to `/usr/src/app`, that mount would **hide the Stockfish binary**. Remove it at the same time as fixing `WORKDIR`.
- There are no liveness or readiness probes. The deployment runs 3 replicas, each starting one Stockfish process per request under an 800m CPU limit.
- Two Stockfish binaries (about 76 MB each) are committed to git.

### 3.10 Frontend

- An unmodified `npm create vite` React 19 + TypeScript template: no router, API client, pages or styling system. The existing choices (React, TypeScript, Vite) match spec §8, so there's nothing to migrate.

---

## 4. What this branch changed

See [ADR 0001](../decisions/0001-modular-monolith-layout.md) for the reasoning.

1. Moved the backend from flat `controller/ model/ routes/ services/` folders into `backend/src/{modules,infrastructure,middleware,routes}` using `git mv`, so file history is kept.
2. Added `backend/src/routes/index.js`, which mounts every module router at **its original URL prefix**.
3. `server.js` now loads `dotenv/config` before anything else.
4. `package.json` `main`, `start` and `dev` now point to `src/server.js`.
5. Moved the Kubernetes manifests to `infrastructure/kubernetes/`. The local `secret.yaml` moved with them and is ignored by a new root `.gitignore`.
6. `.dockerignore` now excludes `.env*`.
7. Added `backend/.env.example` with the variables the code actually reads (the backend README already told people to copy it, but the file didn't exist).
8. Added this document, the plan, the API reference, and ADR 0001.

**No application behaviour changed.** The known bugs above are recorded but deliberately **not fixed** on this branch, so the restructure can be reviewed on its own.

### Verification performed

| Check | Result |
| :-- | :-- |
| Import every backend module (before and after) | 25/25 before, 26/26 after (the new file is `routes/index.js`) |
| Route table diff, before vs after | Identical: 14 router endpoints plus `GET /` and `GET /test` |
| `npm start` | Server listens. The Atlas cluster couldn't be reached from the audit sandbox (DNS `EREFUSED`), so the existing `process.exit(1)` ran. That's a network limit of the sandbox, not a code change. |
| HTTP probe of every route group (Mongo unreachable) | `GET /` → 200, protected routes → 401, `POST /api/auth/login {}` → 400, unknown path → 404 |
| Stockfish from the new path | Returned a best move for the starting position |
| Docker build, Kubernetes apply | **Not run.** The Dockerfile's `COPY . .` and `npm start` still apply unchanged. |
