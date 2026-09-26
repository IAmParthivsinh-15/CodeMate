# CodeMate Backend

Node.js (ES modules) + Express 5 API, Socket.IO gateway and event workers for CodeMate. It's a **modular monolith**: one codebase that runs as a single process in development, or as separate `api` / `realtime` / `worker` roles in production.

- Architecture: [docs/architecture/overview.md](../docs/architecture/overview.md)
- REST API: [docs/api/api.md](../docs/api/api.md)
- WebSocket protocol: [docs/websocket/protocol.md](../docs/websocket/protocol.md)
- Events: [docs/events/kafka-events.md](../docs/events/kafka-events.md)
- RAG: [docs/rag/](../docs/rag/)

## Quick start

Requirements: **Node 20+** and **MongoDB** (local, Docker, or Atlas). Nothing else is required: Redis, Kafka, Qdrant, the LLM provider and Judge0 are optional, and in-process fallbacks take over when they aren't configured ([ADR 0002](../docs/decisions/0002-optional-infrastructure-with-in-process-fallbacks.md)).

```bash
cd backend
npm install
cp .env.example .env        # set MONGO_URL and the two *_TOKEN_SECRET values
npm run seed:problems       # optional: 8 starter coding problems
npm run dev                 # http://localhost:5050
```

On startup the log lists which backends are active, and `GET /ready` reports them:

```json
{ "status": "ready", "backends": { "kv": "memory", "events": "memory", "vector": "memory", "llm": "none" } }
```

The chess knowledge corpus (`../ai/corpus`) is ingested automatically the first time, in about 1 s with local embeddings.

## Scripts

| Script | What it does |
| :-- | :-- |
| `npm run dev` | All roles in one process, auto-restart (nodemon) |
| `npm start` | Same, without nodemon (`SERVICE_ROLE` defaults to `all`) |
| `npm run start:api` / `start:realtime` / `start:worker` | One role each ([service boundaries](../docs/architecture/service-boundaries.md)) |
| `npm run start:otel` | Start with OpenTelemetry auto-instrumentation (set the `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` env vars) |
| `npm test` | Vitest: unit + integration (in-memory MongoDB, real Stockfish) |
| `npm run test:unit` | Unit tests only (no database needed) |
| `npm run lint` | ESLint |
| `npm run seed:admin` | Create the first superadmin (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`) |
| `npm run seed:problems` | Upsert the starter coding problems |
| `npm run ingest [-- --force]` | Chess knowledge ingestion (only changed chunks are embedded) |
| `npm run rag:eval [-- --k 4]` | Retrieval evaluation against `ai/evaluation/chess-rag-eval.json` |
| `npm run stats:rebuild [-- <userId>]` | Recompute dashboard aggregates from source data |

## Configuration

Every variable is declared and validated in [`src/config/env.js`](./src/config/env.js). Invalid configuration stops the process with one message listing every problem. [`.env.example`](./.env.example) documents them all, grouped:

- **Required:** `MONGO_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` (each secret at least 16 characters).
- **Roles:** `SERVICE_ROLE`, `WORKERS`.
- **Infrastructure:** `REDIS_URL`, `KAFKA_BROKERS`, `VECTOR_DB_URL`, `JUDGE0_API_URL` (+ key and host).
- **AI:** `LLM_PROVIDER`, `LLM_MODEL[_SMALL|_MEDIUM|_LARGE]`, the provider keys, `EMBEDDING_PROVIDER`.
- **Engine:** `STOCKFISH_PATH`, `ENGINE_POOL_SIZE`, `ANALYSIS_DEPTH`, `AUTO_ANALYZE`.

> Running more than one `api`/`realtime` instance requires `REDIS_URL`. Running separate worker processes requires `KAFKA_BROKERS`.

## Layout

```text
src/
├── server.js                # role-aware bootstrap and graceful shutdown
├── app.js                   # Express app (helmet, CORS, logging, metrics, rate limits, routes, errors)
├── entry/                   # api.js / realtime.js / worker.js: role entry points
├── config/                  # env.js (validated env), analysis.js (classification thresholds, themes)
├── routes/index.js          # mounts module routers; /health, /ready, /metrics
├── middleware/              # auth, roles, validate (zod), rateLimit, requestId, errorHandler
├── shared/                  # errors (AppError), http helpers, event names and envelope
├── sockets/                 # Socket.IO gateway, sweeper, per-user notifications
├── workers/                 # event consumers: analysis, ai, coding, analytics
├── modules/
│   ├── auth/  users/  admin/
│   ├── games/               # authoritative game service, online rooms, schemas, legacy routes
│   ├── chess/               # openings (ECO), debug engine endpoint
│   ├── ratings/             # Elo, rating history
│   ├── analysis/            # structured Stockfish analysis
│   ├── matchmaking/         # Redis sorted-set queues
│   ├── learning/            # puzzles from mistakes
│   ├── ai/                  # Game RAG, Chess RAG (rag/), explain-move, coach, grounding, prompts
│   ├── coding/              # problems, submissions, legacy execute
│   └── analytics/           # dashboard, statistics, leaderboard, UserStats aggregates
└── infrastructure/
    ├── mongodb/ redis/ kafka/ vector/
    ├── stockfish/           # UCI engine + pool, UCI parsing
    ├── judge0/              # Judge0 client (stdio + legacy function mode)
    ├── llm/                 # provider-agnostic gateway (groq, nvidia, gemini)
    ├── embeddings/          # local hashing embedder, remote providers
    ├── metrics/             # Prometheus registry
    └── logger/              # pino
engine/                      # Stockfish 17.1 binaries (Linux ELF, Windows exe)
scripts/                     # seeding, ingestion, evaluation, maintenance
tests/                       # unit/ and integration/ (vitest + supertest + socket.io-client)
```

**Conventions.**

- Files are named `<name>.routes.js`, `.controller.js`, `.service.js`, `.model.js` and `.schema.js` (zod).
- Controllers throw `AppError`s (Express 5 forwards async errors). They never hand-build error JSON.
- Modules import other modules' models and services, never their controllers.

## How the pieces work

- **Games are server-authoritative.** Each move replays the stored game with chess.js, checks whose turn it is and whether the move is legal, then writes with `findOneAndUpdate({ _id, ply })` (optimistic concurrency). Results, clocks, stats and Elo are all computed on the server.
- **Stockfish.** A fixed pool (`ENGINE_POOL_SIZE`) of UCI processes, with searches serialised per process. Analysis evaluates every position once, in parallel. Classifications use the win-probability drop, with thresholds in `config/analysis.js`.
- **Async pipeline.** A finished game publishes `game.finished`, which triggers analysis, puzzles, `analysis.completed`, the AI report and analytics. Code submissions follow the same pattern through Judge0 ([data flows](../docs/architecture/data-flow.md)).
- **AI.** Rules route questions and select the facts. The LLM only phrases them, its JSON is validated, and a grounding guard discards any invented evaluation. With no LLM configured, deterministic answers are returned ([ADR 0004](../docs/decisions/0004-grounded-ai-with-deterministic-fallbacks.md)).
- **Security.**
  - Passwords are hashed with bcrypt (cost 12). Refresh tokens are stored hashed and rotate on each use.
  - User and admin JWTs carry a `typ` claim, and each token has a unique `jti`.
  - Cookies are httpOnly, `SameSite=Strict`, and `Secure` in production.
  - `helmet`, a CORS allowlist, zod validation on every body/params/query, and Redis-backed rate limits.
  - Other users' resources return 404. Hidden coding tests are never returned.

## Testing

```bash
npm test                                     # starts an in-memory MongoDB (downloads mongod once)
MONGOMS_SYSTEM_BINARY=/path/to/mongod npm test   # reuse a local mongod binary instead
TEST_MONGO_URL=mongodb://127.0.0.1:27017 npm test   # use a running server (CI does this)
```

There are 67 tests:

- **Unit:** UCI parsing, Elo, openings, classification thresholds, rules, the intent router, grounding, move selection, chunking, embeddings, events.
- **Integration:** auth, games (AI/local/legacy), the full finished-game → analysis → puzzles → AI report → dashboard → coach pipeline, the RAG endpoints and grounding guard, coding with a fake Judge0, and Socket.IO multiplayer (rooms, duplicate moves, draws, resignation, reconnect, matchmaking).

## Docker and Kubernetes

The image is built from the **repo root**, because it needs `ai/`:

```bash
docker build -f infrastructure/docker/backend/Dockerfile -t codemate-backend .
docker compose up --build                       # full stack at http://localhost:8080 (see root README)
kubectl apply -k infrastructure/kubernetes      # after creating the Secret from secret.example.yaml
```

## Legacy API

The pre-Phase-0 routes (`/api/game/*`, `/api/game-analysis/*`, `/api/code/execute`) still work, backed by the new services. See the "Legacy endpoints" section of the [API reference](../docs/api/api.md) for the few behaviour changes.
