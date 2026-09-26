# CodeMate — Phase 0 and Phase 1 Implementation Plan

> **Status:** Implemented (2026-09-26), along with phases 2–17. Decisions taken: D1 (b) new `/api/games/*` plus legacy routes, D2 zod, D3 vitest, D4 httpOnly cookies + Vite proxy (plus Bearer), D5 pino. Deviations and the current state are in [implementation-status.md](./implementation-status.md).
> **Based on:** [gap-analysis.md](./gap-analysis.md)
> **Rule from the spec:** finish Phase 0 before starting Phase 1, and don't start Phase 2 until Phase 1 meets its acceptance criteria.

Paths are relative to `backend/` or `frontend/` unless shown otherwise. Each step is small enough to be its own commit or PR.

---

## Decisions needed before starting

These change what gets built. Each has a recommended default.

| # | Decision | Options | Recommended |
| :-- | :-- | :-- | :-- |
| D1 | API path style for new endpoints | (a) keep extending `/api/game/*`; (b) add spec-style `/api/games/*` alongside it and keep the old paths working | **(b)**: new plural routes, old routes left in place and marked deprecated in `docs/api/api.md` |
| D2 | Request validation library | zod, joi, express-validator | **zod**: small, and the same schemas can be reused by the frontend later |
| D3 | Test runner | vitest, jest, node:test | **vitest** for both backend and frontend: one tool, native ES modules |
| D4 | How the frontend holds auth | (a) the httpOnly cookies the backend already sets; (b) bearer token held in memory | **(a)**, with a Vite dev proxy so the app and API share an origin |
| D5 | Logger | pino, winston | **pino** + `pino-http`: structured JSON, low overhead |

---

## Phase 0 — Stabilise the backend

### P0.1 Split the app from the server (so it can be tested)

| Action | File |
| :-- | :-- |
| Create | `src/app.js`: builds and exports the Express `app` (middleware + routes), with no `listen` call |
| Change | `src/server.js`: loads env, connects to Mongo, **then** calls `app.listen` (today it listens before the DB connects) |

### P0.2 Environment validation

| Action | File |
| :-- | :-- |
| Create | `src/config/env.js`: zod schema for every variable in `.env.example`. Reports all missing or invalid variables at once and exits. Exports a frozen `env` object. |
| Change | Every `process.env.X` read in `src/**` switches to `env.X` |
| Change | `.env.example`: add `NODE_ENV`, `CORS_ORIGINS`, `GEMINI_MODEL`, `STOCKFISH_PATH` (optional override) |
| Change | `infrastructure/kubernetes/deployment.yaml`: remove `JUDGE0_APP` and `REQ_URL`, which nothing reads |

### P0.3 Logging and request IDs

| Action | File |
| :-- | :-- |
| Create | `src/infrastructure/logger.js`: pino instance, pretty output in development, JSON in production |
| Create | `src/middleware/requestId.js`: reuses an incoming `x-request-id` header or generates one, and echoes it in the response |
| Change | Replace `console.*` across `src/**`. Remove the log lines that print the full user or admin document, and the per-line Stockfish output. |

### P0.4 Consistent errors (spec §52)

| Action | File |
| :-- | :-- |
| Create | `src/shared/errors.js`: `AppError(code, message, status)` plus helpers (`notFound`, `forbidden`, `badRequest`, …) |
| Create | `src/middleware/errorHandler.js`: returns `{ success:false, error:{ code, message }, requestId }`. Stack traces are only included when `NODE_ENV=development`. |
| Create | `src/middleware/notFound.js`: JSON 404 instead of Express's HTML page |
| Change | Controllers throw `AppError`s instead of hand-writing `res.status(...).json(...)`. Express 5 forwards async errors on its own. |

> **Compatibility:** existing clients read `body.message`. During Phase 0, error responses **also** include a top-level `message` field. It is removed only once the new frontend is the only client.

### P0.5 Validation and security middleware

| Action | File |
| :-- | :-- |
| Create | `src/middleware/validate.js`: `validate({ body, params, query })` using zod |
| Create | `src/modules/*/[name].schema.js`: one schema file per module (auth, games, coding, analysis) |
| Change | `src/app.js`: add `helmet()`, `cors({ origin: env.CORS_ORIGINS, credentials: true })`, and `express.json({ limit: '100kb' })` |
| Create | `src/middleware/rateLimit.js`: `express-rate-limit` with an in-memory store for auth, code execution and analysis. It moves to Redis in Phase 5. |

### P0.6 Fix confirmed defects

Each item links to its gap-analysis section. **The fix for each item includes a test.**

| # | Defect (gap §) | Fix | File(s) |
| :-- | :-- | :-- | :-- |
| 1 | Analysis crashes on unbound `this` (3.5) | Bind the methods in the constructor, or convert them to arrow properties | `modules/analysis/gameAnalysis.controller.js` |
| 2 | No ownership checks (3.3) | Filter with `{ _id: gameId, player: req.user._id }` and return 404 when nothing matches | `modules/games/game.controller.js` |
| 3 | Client-trusted moves and results (3.3) | Rebuild the game in chess.js from its stored moves, apply the incoming move, and reject illegal ones. The server computes the FEN and the result. | `modules/games/game.controller.js`, new `modules/games/game.service.js` |
| 4 | Bot move not routed (3.3) | Add `POST /api/game/bot-move` (and `/api/games/:id/bot-move` if D1 = b). Record the FEN **after** the move. | `game.routes.js`, `game.controller.js` |
| 5 | Unauthenticated `GET /test` (3.4) | Remove it from production; available only when `NODE_ENV=development` | `src/routes/index.js` |
| 6 | Stockfish commands run concurrently, leaked process, no mate scores (3.4, 3.5) | Queue commands per engine instance, wait for `readyok`, parse `score mate`, read the evaluation at the final depth, remove the duplicate `initializeEngine()` call | `infrastructure/stockfish/chessEngine.js` |
| 7 | Hidden test answers leak (3.7) | Mark hidden cases on the server and strip `output`/`expected` from them | `modules/coding/codeExecution.controller.js` |
| 8 | Normal users can't fetch problems (3.7) | Add user-facing `GET /api/coding/problems` and `GET /api/coding/problems/:id` that omit hidden test cases. Keep the admin route. | `modules/coding/codingQuestion.*` |
| 9 | Small correctness bugs | `question.description` → `statement`; set `req.startTime`; add `endedAt` to the schema; increment `gamesPlayed`; make cookie `maxAge` follow the env expiry; enforce password length before hashing | several |
| 10 | Deprecated Mongo options | Remove `useNewUrlParser` / `useUnifiedTopology` | `infrastructure/mongodb/connection.js` |
| 11 | Hard-coded Gemini model | Read `env.GEMINI_MODEL` | `infrastructure/llm/geminiService.js` |

### P0.7 Bootstrapping and dependencies

| Action | File |
| :-- | :-- |
| Create | `scripts/seed-superadmin.js` + `npm run seed:admin`: reads credentials from env or prompts, and does nothing if one already exists |
| Change | `package.json`: remove `bcryptjs`, `mongodb`, `stockfish`, `crypto`, `@types/*`; move `nodemon` to devDependencies; add `lint`, `test`, `seed:admin` scripts; set `"engines": { "node": ">=20" }` |
| Create | `eslint.config.js`: flat config for Node with ES modules |

### P0.8 Tests

| Action | File |
| :-- | :-- |
| Add deps | `vitest`, `supertest`, `mongodb-memory-server` |
| Create | `tests/setup.js`: in-memory Mongo, test env |
| Create | `tests/auth.test.js`: register, login, me, refresh, logout, validation errors |
| Create | `tests/games.test.js`: start, legal move, illegal move rejected, another user's game → 404, end-of-game result computed by the server |
| Create | `tests/analysis.classify.test.js`: classification thresholds (pure function, no engine needed) |
| Create | `tests/coding.test.js`: hidden cases stripped (Judge0 mocked) |
| Create | `tests/chessEngine.test.js`: UCI output parsing for `cp` and `mate` (no binary needed) |

### P0.9 Runtime and local development

| Action | File |
| :-- | :-- |
| Create | `GET /health` (liveness) and `GET /ready` (Mongo connected) in `src/routes/index.js` |
| Change | `Dockerfile`: `node:22-slim`, `WORKDIR /usr/src/app`, `npm ci --omit=dev`, run as a non-root user, `HEALTHCHECK` |
| Change | `infrastructure/kubernetes/deployment.yaml`: remove the `emptyDir` engine mount (it would hide the binary once `WORKDIR` changes), add liveness and readiness probes |
| Create | `docker-compose.yml` (repo root): `mongodb` + `backend` only. Redis, Kafka and Qdrant are added in the phases that use them (spec §2). |
| Create | `infrastructure/kubernetes/secret.example.yaml`: key names only, placeholder values |

### P0.10 Docs

- Update `backend/README.md` (setup, env, scripts, testing) and `docs/api/api.md` (new endpoints, error format).

### Phase 0 acceptance criteria

- [ ] `cp .env.example .env && npm install && npm run dev` starts against the Mongo in `docker compose up mongodb`.
- [ ] Missing or invalid env variables produce one readable error listing every problem.
- [ ] `npm test` and `npm run lint` pass.
- [ ] Every existing endpoint still answers at its old path.
- [ ] Every item in P0.6 has a test that failed before its fix.

---

## Phase 1 — Frontend foundation

The existing stack (React 19, TypeScript, Vite) already matches spec §8.

### P1.1 Dependencies and tooling

| Add | Why |
| :-- | :-- |
| `react-router` | Routing and protected routes |
| `@tanstack/react-query` | Server state: caching, loading and error states |
| `tailwindcss` + `@tailwindcss/vite` | Shared styling system (spec §54) |
| `chess.js`, `react-chessboard` | Board display and local move legality (the server still has the final say) |
| `vitest`, `@testing-library/react`, `jsdom` | Frontend tests |

Not added yet: **Zustand**, until there is client state that TanStack Query can't hold (spec §8: "do not add state libraries everywhere"). **Monaco**, until Phase 11.

`vite.config.ts` gets a dev proxy: `/api → http://localhost:5050`.

### P1.2 File layout

```text
frontend/src/
├── main.tsx                         # mounts <App/>
├── app/
│   ├── App.tsx                      # providers + router
│   ├── router.tsx                   # route table (spec §8 pages)
│   └── providers.tsx                # QueryClientProvider, etc.
├── services/
│   └── apiClient.ts                 # fetch wrapper: credentials, JSON, error normalisation, one refresh retry on 401
├── types/
│   └── api.ts                       # User, GameSession, GameAnalysis, CodingProblem, ApiError
├── components/
│   ├── layout/{AppShell,Navbar,ProtectedRoute}.tsx
│   └── ui/{Button,Card,Input,Spinner,EmptyState,ErrorState,PageHeader}.tsx
├── features/
│   ├── auth/{api.ts,hooks.ts,LoginPage.tsx,RegisterPage.tsx}
│   ├── chess/{ChessBoard.tsx,MoveList.tsx,GameControls.tsx,GameStatus.tsx,useChessGame.ts}
│   ├── games/{api.ts,PlayAiPage.tsx,PlayLocalPage.tsx}
│   ├── coding/{api.ts,ProblemListPage.tsx}
│   └── profile/{ProfilePage.tsx}
├── pages/
│   ├── LandingPage.tsx
│   ├── DashboardPage.tsx
│   ├── NotFoundPage.tsx
│   └── ComingSoonPage.tsx           # used by routes whose backend lands in a later phase
└── index.css                        # Tailwind entry + design tokens
```

Delete the template files `App.css`, `assets/react.svg` and `public/vite.svg`.

### P1.3 Routes

| Route | Phase 1 behaviour | Backend it uses |
| :-- | :-- | :-- |
| `/`, `/login`, `/register` | Complete | `/api/auth/*` |
| `/dashboard` | Complete, with the data that exists (chess stats from `/me`) | `/api/auth/me` |
| `/play`, `/play/ai`, `/play/local` | Complete | `/api/game/start`, `save`, `end`, `bot-move` (P0.6 #4) |
| `/games`, `/games/:id`, `/games/:id/analysis` | Coming-soon page (Phase 3) | — |
| `/play/online`, `/play/online/:id` | Coming-soon page (Phase 4) | — |
| `/ai-coach`, `/chess-knowledge` | Coming-soon page (Phases 7–8, 12) | — |
| `/coding` | Problem list | `/api/coding/problems` (P0.6 #8) |
| `/coding/:id`, `/coding/submissions` | Coming-soon page (Phase 11) | — |
| `/profile`, `/settings` | Profile read-only; settings coming soon | `/api/auth/me` |

Every data view handles **loading, empty and error** states through the shared `ui/` components.

### P1.4 Tests

- `features/auth/*.test.tsx`: login success and failure; `ProtectedRoute` redirects when signed out.
- `features/chess/useChessGame.test.ts`: move application, game-over detection.
- `services/apiClient.test.ts`: error normalisation, refresh retry.

### P1.5 Docs

- Replace `frontend/README.md` (currently the Vite template) with setup, scripts and folder conventions.
- Update the root `README.md` project-status section.

### Phase 1 acceptance criteria

- [ ] `npm install && npm run dev` in `frontend/` with the backend running: register, log in, see the dashboard, play a full game against the bot and a local game, and see them saved.
- [ ] `npm run build`, `npm run lint` and `npm test` pass.
- [ ] Usable at phone width (about 400px).

---

## After Phase 1

Continue with spec §49 in order: Phase 2 (complete chess AI and local game), then Phase 3 (history, replay, analysis UI). Don't skip ahead to Redis, Kafka or RAG.
