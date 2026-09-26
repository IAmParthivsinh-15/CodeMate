# Service Boundaries and Deployment Roles

Spec §50 lists possible microservices and adds: *"Do not create a service if its independent scaling/deployment/ownership does not provide a meaningful benefit."* CodeMate therefore extracts services as **deployable process roles of one codebase**, where separation pays off, and keeps module boundaries inside the code for the rest. See [ADR 0003](../decisions/0003-service-extraction-by-role.md).

## Roles

| `SERVICE_ROLE` | Runs | Scales on | Entry |
| :-- | :-- | :-- | :-- |
| `all` | Everything (development, small deployments) | — | `npm run dev` / `npm start` |
| `api` | REST API | Request rate / CPU | `npm run start:api` |
| `realtime` | Socket.IO gateway, clock/abandonment sweeper, matchmaking, plus the REST API | Concurrent connections | `npm run start:realtime` |
| `worker` | Event consumers listed in `WORKERS` | Kafka lag / CPU | `npm run start:worker` |

Worker names (consumer groups):

| Worker | Consumes | Does |
| :-- | :-- | :-- |
| `analysis` | `game.finished`, `analysis.requested` | Stockfish analysis, puzzle generation (CPU heavy, the main scaling target) |
| `ai` | `analysis.completed` | Post-game AI report |
| `coding` | `code.submitted` | Judge0 execution |
| `analytics` | `analysis.completed`, `game.finished`, `code.completed`, `ai.chat.completed`, `rating.updated` | Aggregates, cache invalidation |

## How the spec's candidate services map

| Spec §50 service | CodeMate | Extracted? |
| :-- | :-- | :-- |
| auth-service, user-service | `modules/auth`, `users`, `admin` | No: low load, and they share the user model. The seam is `middleware/auth.js` (`userFromToken`). |
| game-service | `modules/games`, `chess`, `ratings` | In-process with the API; the realtime role reuses the same service functions |
| realtime-service | `sockets/` + `SERVICE_ROLE=realtime` | **Yes**: scales with connections, needs sticky sessions / the Redis adapter |
| analysis-service | `modules/analysis` + analysis worker | **Yes**: CPU-bound Stockfish, scales on lag |
| coding-service | `modules/coding` + coding worker | **Yes**: the worker is extracted; the problem CRUD stays in the API |
| ai-service | `modules/ai` + ai worker | **Partly**: the async report is a worker; chat stays synchronous in the API |
| analytics-service | `modules/analytics` + analytics worker | **Yes**: the worker is extracted; dashboard reads stay in the API |

## Rules that keep boundaries clean

1. Modules talk to each other through exported service functions. Only models are shared, never controllers.
2. Anything a worker needs arrives in an event payload of ids (see [../events/kafka-events.md](../events/kafka-events.md)). Workers read durable state from MongoDB, never from the API process.
3. Synchronous HTTP when the caller needs an answer now; Kafka when it can happen later; WebSockets for bidirectional real-time traffic; Redis for temporary or coordination data; MongoDB for durable data (spec §51).
4. Extracting a module into its own repository later means moving its folder and replacing in-process calls with HTTP calls at these seams. The event contracts already stay the same.
