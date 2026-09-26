# CodeMate ♟️<>💻

> **Chess × Code × AI**: play, analyse, learn, practise, improve.

CodeMate is a learning platform for people who love chess and programming. Play Stockfish, a friend on the same device, or opponents online in real time. Every finished game is analysed by Stockfish move by move, and an AI coach explains your mistakes using the engine's facts. Your mistakes become puzzles. Coding problems earn you engine hints: **solve code to unlock chess help**.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Kafka](https://img.shields.io/badge/Kafka-231F20?style=for-the-badge&logo=apachekafka&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)

---

## What you can do

| | |
| :-- | :-- |
| **Play** | Against Stockfish at six levels (Elo 1000–2700), pass-and-play on one device, or online: private rooms with a code, or rated/casual quick match with clocks. |
| **Analyse** | Every finished game is analysed in the background: accuracy, centipawn loss, best moves, lines, and classifications from *book* to *blunder*, with themes such as "hanging piece" or "allowed mate". |
| **Ask about your game** | "Why was move 23 a mistake?", "Where did I lose the advantage?", "Did I repeat the same mistake?" The AI answers from Stockfish's facts about *your* game and never invents evaluations. |
| **Explain this move** | One click gives: what happened, why it matters, the better move, the concept, and what to look for next time. |
| **Practise your mistakes** | Positions where you went wrong become puzzles. Find the move Stockfish wanted. |
| **Learn chess** | Ask general questions ("What is zugzwang?", "Explain the Lucena position") answered from a 47-topic chess guide, with sources. |
| **Get coached** | A personal report built only from your stored games: strengths, weaknesses, recurring mistakes, trends per skill, recommended study and puzzles, and a training plan. |
| **Code for hints** | Solve coding problems (JavaScript, Python, Java, C++) judged in a sandbox. Each new problem solved earns a Stockfish hint for your games. |
| **Track progress** | A dashboard with rating history, accuracy, mistake distribution, openings, coding stats and leaderboards. |

## Run it

**Everything with Docker** (MongoDB, Redis, Kafka, Qdrant, API, realtime gateway, workers, frontend):

```bash
cp .env.example .env              # set ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET
docker compose up --build         # → http://localhost:8080
docker compose --profile observability up   # + Prometheus :9090 and Grafana :3000
```

**Development** (only MongoDB needed; everything else falls back to in-process versions):

```bash
cd backend && npm install && cp .env.example .env && npm run seed:problems && npm run dev   # :5050
cd frontend && npm install && npm run dev                                                   # :5173
```

Optional: set `LLM_PROVIDER` (Groq, NVIDIA or Gemini) for natural-language AI answers; without it, answers are composed directly from engine facts. Set `JUDGE0_API_URL` to run code submissions.

## Repository layout

```text
CodeMate/
├── frontend/          React + TypeScript SPA                        → frontend/README.md
├── backend/           API, realtime gateway, workers (one codebase) → backend/README.md
├── ai/                Chess knowledge corpus, prompts, RAG eval set → ai/README.md
├── infrastructure/    docker/, kubernetes/, kafka/, redis/, prometheus/, grafana/, ci/
├── docs/              architecture/, api/, websocket/, events/, rag/, decisions/
├── docker-compose.yml
└── ENHANCEMENT.md     The engineering specification this project implements
```

## How it's built

| Area | Technology | Why |
| :-- | :-- | :-- |
| Frontend | React 19, TypeScript, Vite, Tailwind, TanStack Query, react-chessboard, CodeMirror | One coherent, responsive product UI |
| API | Node.js, Express 5, zod, pino | A modular monolith with validated input and consistent errors |
| Real time | Socket.IO (+ Redis adapter) | Server-authoritative online play, reconnects, presence |
| Data | MongoDB | The durable source of truth |
| Live state | Redis | Game state, presence, matchmaking, rate limits, caches |
| Async | Kafka + workers | Analysis, AI reports, code judging and analytics off the request path |
| Chess | Stockfish 17.1, chess.js | Deterministic engine facts and rules |
| AI | LLM gateway (Groq / NVIDIA / Gemini), hybrid BM25 + vector RAG, Qdrant | Grounded explanations, with deterministic fallbacks |
| Code | Judge0 | Sandboxed execution; user code never runs in the backend |
| Ops | Docker, Kubernetes, Prometheus, Grafana, OpenTelemetry, GitHub Actions | Reproducible, observable deployments |

The system is **functional first, scalable second, distributed third**. It runs as one process on a laptop and as separately scaled roles in production. Start with [docs/architecture/overview.md](docs/architecture/overview.md).

## Documentation

- [Architecture overview](docs/architecture/overview.md) · [Data flows](docs/architecture/data-flow.md) · [Service boundaries](docs/architecture/service-boundaries.md)
- [REST API](docs/api/api.md) · [WebSocket protocol](docs/websocket/protocol.md) · [Kafka events](docs/events/kafka-events.md)
- [Game Analysis RAG](docs/rag/game-rag.md) · [Chess Knowledge RAG](docs/rag/chess-rag.md)
- [Implementation status](docs/architecture/implementation-status.md) (what's done, how it was verified, known limitations)
- [Architecture decisions](docs/decisions/)

## Testing

```bash
cd backend && npm test      # 67 tests: unit + integration (API, pipeline, RAG, coding, multiplayer)
cd frontend && npm test     # 50 tests
```

CI is defined in `infrastructure/ci/github-actions-ci.yml`. Copy it to `.github/workflows/` to enable it ([why](docs/decisions/0005-ci-workflow-location.md)).

## Contributing

Fork the repository, create a feature branch, and open a pull request. Please run the tests and lint for both packages first. Each phase's "definition of done" is in [ENHANCEMENT.md §61](ENHANCEMENT.md).
