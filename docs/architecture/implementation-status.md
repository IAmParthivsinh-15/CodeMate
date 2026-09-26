# CodeMate — Implementation Status

> **As of:** 2026-09-26, branch `restructure/phase-0`
> **Compared against:** [ENHANCEMENT.md](../../ENHANCEMENT.md) §49 (phases 0–17)
> **Previous state:** [gap-analysis.md](./gap-analysis.md) (historical)

## Verification legend

| Mark | Meaning |
| :-- | :-- |
| ✅ **Verified** | Covered by automated tests that pass, or run end-to-end during development |
| 🟨 **Built, not run here** | Implemented and reviewed, but needs infrastructure that wasn't available (no Docker daemon, no LLM/Judge0 keys) |

## Phase by phase

| Phase | Scope | Where | Status |
| :-- | :-- | :-- | :-- |
| 0 | Stabilisation: env validation, logging, error format, validation, security headers, rate limits, `.env.example`, tests, lint, admin seed | `backend/src/{config,middleware,shared}`, `tests/` | ✅ 67 tests, lint clean, `npm audit` 0 vulnerabilities |
| 1 | Frontend foundation | `frontend/` | See [Frontend](#frontend) |
| 2 | Complete chess vs AI + local: colour, difficulty, legal moves, engine replies, resign/abort/draw, checkmate/stalemate/draw detection, PGN, hints | `modules/games`, `infrastructure/stockfish` | ✅ `games.test.js` |
| 3 | Persistence, history (paginated), replay data, analysis UI data | `modules/games`, `modules/analysis` | ✅ API; UI in frontend |
| 4 | P2P WebSocket multiplayer: rooms, moves, draw, pause, resign, reconnect, disconnect grace, duplicate protection | `sockets/`, `modules/games/online.service.js` | ✅ `realtime.test.js` (in-memory adapter) |
| 5 | Redis: live state, presence, rooms, matchmaking, rate limiting, caches | `infrastructure/redis`, `modules/matchmaking` | ✅ via the in-memory store; 🟨 against a real Redis |
| 6 | Structured Stockfish analysis: per-move CPL, win-probability accuracy, configurable classification, PV, themes, phases | `modules/analysis`, `config/analysis.js` | ✅ `pipeline.test.js` + unit tests |
| 7 | Game Analysis RAG: intent routing, move selection, facts, history, knowledge, grounding guard, explain-move, practice | `modules/ai` | ✅ deterministic path + fake-LLM grounding tests; 🟨 with a real LLM |
| 8 | Chess Knowledge RAG: corpus (47 docs), ingestion, hybrid retrieval, evaluation | `ai/`, `modules/ai/rag` | ✅ hit@4 85% offline ([chess-rag.md](../rag/chess-rag.md)); 🟨 Qdrant, remote embeddings |
| 9 | LLM gateway: Groq / NVIDIA / Gemini, task-tier routing, JSON validation, metrics | `infrastructure/llm` | ✅ contract via a fake provider; 🟨 real providers (no keys) |
| 10 | Kafka + workers: versioned events, 4 consumer groups, idempotent handlers, lag metric, topic creation | `infrastructure/kafka`, `workers/` | ✅ via the in-process bus; 🟨 against a real Kafka |
| 11 | Coding platform: problems, async submissions, Judge0 (stdio + legacy), history, hint credits, seed problems | `modules/coding`, `infrastructure/judge0` | ✅ `coding.test.js` with a fake Judge0; 🟨 against real Judge0; seed test cases checked against reference solutions (39/39) |
| 12 | Personalised AI coach: evidence report, skill categories, trends, plan, narrative, chat | `modules/ai/coach.service.js` | ✅ `pipeline.test.js` |
| 13 | Puzzle generation and training | `modules/learning` | ✅ `pipeline.test.js` |
| 14 | Analytics and dashboard: stats, aggregates worker, leaderboards, caching | `modules/analytics` | ✅ `pipeline.test.js` |
| 15 | Service extraction: `api` / `realtime` / `worker` roles | `server.js`, `entry/` | ✅ all-in-one boot; 🟨 split roles over Kafka/Redis ([ADR 0003](../decisions/0003-service-extraction-by-role.md)) |
| 16 | Docker hardening + Kubernetes | `infrastructure/docker`, `infrastructure/kubernetes`, `docker-compose.yml` | ✅ YAML parses, `docker compose config` valid; 🟨 image builds and `kubectl apply` |
| 17 | Observability + CI: Prometheus metrics, Grafana, alerts, request ids, OpenTelemetry script, GitHub Actions | `infrastructure/{prometheus,grafana,ci}` | ✅ `/metrics` served; 🟨 Grafana/Prometheus/OTel running, CI (not enabled, see [ADR 0005](../decisions/0005-ci-workflow-location.md)) |

## Gap-analysis defects: resolution

| Defect (gap §) | Resolution |
| :-- | :-- |
| Analysis crash from an unbound `this` (3.5) | Controller replaced by `analysis.service.js`; covered by tests |
| No ownership checks (3.3) | `loadGameFor` everywhere; returns 404; tested |
| Client-trusted moves and results (3.3) | chess.js replay + conditional writes; the legacy `/end` can't claim wins; tested |
| Bot move not routed (3.3) | `POST /api/games/:id/moves` replies automatically; `/bot-move` routes |
| Public `GET /test` (3.4) | Now `POST`, only with `ENABLE_DEBUG_ROUTES=true` |
| Concurrent UCI commands, leaked engine, no mate scores (3.4) | Serialised queue, pool, mate parsing, final-depth scores |
| Accuracy not based on centipawn loss; hard-coded thresholds (3.5) | CPL + win-probability accuracy; thresholds in `config/analysis.js` |
| Hidden test answers leaked (3.7) | Never returned or stored; tested |
| Users couldn't fetch problems (3.7) | `/api/coding/problems*` |
| `timeTaken` NaN, `description` undefined, `endedAt` dropped, `gamesPlayed` never updated | Fixed; `timeTaken` and `description` tested |
| Plain-text refresh tokens, identical tokens within one second | Hashed at rest, rotation, `jti`; tested |
| Password hash logged; minlength checked against the hash | Removed; zod enforces 8+ characters |
| `.env` copied into the Docker image (3.9) | Root `.dockerignore` excludes it. **Rotate any credentials that were in an image you pushed.** |
| `emptyDir` mount hiding Stockfish (3.9) | Removed with the old manifests |
| Unused dependencies, deprecated Mongo options | Removed |

## Known limitations and follow-ups

1. **Unrun infrastructure:** real Redis, Kafka, Qdrant, Judge0 and the LLM providers were never exercised, because there was no Docker daemon and no API keys. The adapters sit behind the same interfaces as the tested in-process fallbacks. First step: `docker compose up --build`, then play and finish a game, and watch the worker logs.
2. **LLM model names** in `infrastructure/llm/index.js` are defaults and may be out of date. Set `LLM_MODEL*`.
3. **CI** must be copied into `.github/workflows/` to run ([ADR 0005](../decisions/0005-ci-workflow-location.md)).
4. **Corpus review:** a strong player should skim the prose-only strategic sections and the Philidor description.
5. **Retrieval** with the offline embedder misses paraphrases that share no vocabulary (hit@4 85%). Measure again with `EMBEDDING_PROVIDER=gemini|nvidia`.
6. **AI streaming** responses (spec §56, "where useful") are not implemented. Answers come back whole.
7. **Legacy submissions** embedded in `User.submissions` aren't migrated to the `submissions` collection. New submissions go only to the collection.
8. **Kubernetes** assumes managed MongoDB, Redis and Kafka; stateful services are intentionally not self-hosted (spec §45).
9. **Credentials:** the local `infrastructure/kubernetes/secret.yaml` (gitignored) still has the old name `codemate-backend-secrets` and real credentials. Recreate it from `secret.example.yaml` as `codemate-secrets`, and rotate the values.

## Frontend

React 19 + TypeScript + Vite + Tailwind v4, TanStack Query, react-router 7, chess.js + react-chessboard 5, socket.io-client, CodeMirror, recharts. Details: [frontend/README.md](../../frontend/README.md).

| Area | Status |
| :-- | :-- |
| All spec §8 routes (plus `/puzzles`, 404), protected routes, lazy loading | ✅ |
| AI / local / online play: clocks, hints, resign, abort, draw, pause, room codes, quick match, connection + opponent-presence states | ✅ scripted socket run + headless browser |
| Replay, analysis page (eval graph, classifications, Explain with AI, Practice this position, AI report, game chat with facts and sources) | ✅ headless browser |
| Chess knowledge, AI coach, puzzles, coding (editor, run/submit, live status, 503 banner), submissions, dashboard, profile, settings | ✅ |
| Loading, empty, error, offline and reconnecting states; light/dark themes; 360 px layout | ✅ |
| Tests | ✅ 50 tests (API client refresh/envelope, protected routes, login flow, replay, formatters, clock); lint and build clean; `npm audit` 0 |

Frontend limitations:

- The AI-game setup doesn't offer a clock.
- Local games auto-flip after the server confirms the move.
- Training-plan checkboxes are stored in the browser only.

Two backend issues the frontend work found were fixed:

- The socket handshake now reports `TOKEN_EXPIRED` / `TOKEN_INVALID` instead of a generic `UNAUTHORIZED`.
- Finished games that will be auto-analysed report `analysisStatus: "pending"` immediately.
