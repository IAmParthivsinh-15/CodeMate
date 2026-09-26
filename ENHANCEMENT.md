# CodeMate — Project Enhancement & Engineering Specification

> **Document purpose:** This file is the implementation specification for evolving CodeMate from its current backend-focused state into a complete AI-powered Chess + Coding platform.
>
> **Audience:** Coding agents, AI agents, and developers working directly on the CodeMate repository.
>
> **Primary rule:** Do not treat this document as a request to rewrite the project from scratch. Preserve working functionality, understand the existing code before changing it, and implement the enhancement in phases.

---

# 1. Project Vision

## 1.1 Current Project

CodeMate is currently a backend-oriented application combining:

- Chess gameplay
- Chess AI / Stockfish analysis
- User authentication
- Game persistence
- Coding challenges
- Code execution integration
- AI-assisted functionality
- MongoDB persistence
- Docker/Kubernetes-oriented infrastructure

The repository currently contains a parent-level README and a backend README. The backend is the main implemented portion, while the frontend and several advanced capabilities are planned or incomplete.

## 1.2 Main Motive of This Enhancement

The goal is to transform CodeMate into a **production-style AI-powered Chess + Coding learning platform**.

The final product should allow users to:

1. Create an account and maintain a profile.
2. Play chess against AI.
3. Play chess against another user in real time.
4. Save and replay games.
5. Analyze completed games with Stockfish.
6. Ask an AI questions about a specific game.
7. Ask why a particular move was bad.
8. Practice positions created from their own mistakes.
9. Ask general chess questions through a dedicated Chess Knowledge RAG.
10. Receive personalized chess learning recommendations.
11. Solve coding challenges.
12. Execute code through Judge0 or an equivalent execution service.
13. Track coding and chess progress.
14. Eventually receive a unified AI learning profile.
15. Use a modern React frontend rather than interacting primarily with backend APIs.

The project should demonstrate strong engineering across:

- Frontend development
- Backend development
- REST APIs
- WebSockets
- Real-time systems
- MongoDB
- Redis
- Kafka
- asynchronous workers
- RAG
- vector search
- LLM integration
- Stockfish
- code execution
- Docker
- Kubernetes
- observability
- event-driven architecture
- microservices architecture

---

# 2. Product Philosophy

CodeMate should not become a collection of unrelated technologies.

Every technology must solve a real problem.

Use:

- **MongoDB** for durable application data.
- **Redis** for ephemeral/live state, caching, presence, matchmaking and rate limiting.
- **Kafka** for asynchronous domain events and background processing.
- **WebSockets** for real-time multiplayer communication.
- **Stockfish** for deterministic chess analysis.
- **Qdrant or MongoDB Vector Search** for semantic retrieval.
- **LLM providers** such as Groq/NVIDIA/Gemini through an abstraction layer.
- **Docker** for reproducible local/runtime environments.
- **Kubernetes** only after the application is stable.
- **Prometheus/Grafana/OpenTelemetry** when observability becomes useful.

Do not introduce infrastructure simply because it looks impressive.

---

# 3. Core Product Modules

The final CodeMate platform should consist of these major modules:

```text
CodeMate
│
├── Authentication & Users
│
├── Chess
│   ├── AI Game
│   ├── Local Game
│   ├── P2P Multiplayer
│   ├── Matchmaking
│   ├── Game History
│   ├── Game Replay
│   └── Game Analysis
│
├── AI
│   ├── Game Analysis RAG
│   ├── Chess Knowledge RAG
│   ├── AI Game Chat
│   ├── Chess Knowledge Chat
│   ├── AI Coach
│   └── Personalized Recommendations
│
├── Coding
│   ├── Problems
│   ├── Code Editor
│   ├── Code Execution
│   ├── Submissions
│   ├── Results
│   └── Coding Analytics
│
├── Learning
│   ├── Mistake Practice
│   ├── Chess Puzzles
│   ├── Training Plans
│   └── Skill Progression
│
├── Analytics
│   ├── Chess Statistics
│   ├── Coding Statistics
│   ├── AI Usage
│   └── Learning Progress
│
└── Infrastructure
    ├── Redis
    ├── Kafka
    ├── Vector DB
    ├── Workers
    ├── Docker
    └── Kubernetes
```

---

# 4. Target Architecture

## 4.1 Architectural Evolution

Do NOT immediately split the repository into many microservices.

The project should evolve through:

```text
Current Backend
      ↓
Modular Monolith
      ↓
Complete Frontend + Backend
      ↓
WebSocket Multiplayer
      ↓
Redis
      ↓
RAG
      ↓
Kafka + Workers
      ↓
Service Extraction
      ↓
Microservices
      ↓
Kubernetes + Observability
```

This avoids premature distributed-system complexity.

---

# 5. Target High-Level Architecture

The final target architecture should approximately look like:

```text
                         ┌──────────────────────┐
                         │       FRONTEND       │
                         │ React + TypeScript   │
                         │ Tailwind + Vite      │
                         └──────────┬───────────┘
                                    │
                           HTTPS / WebSocket
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ API Gateway / BFF    │
                         └──────────┬───────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
      Auth/User Module       Chess/Game Module       Coding Module
             │                      │                      │
             │                      │                      │
             ▼                      ▼                      ▼
          MongoDB                 Redis                  Judge0
                                    │
                                    ▼
                             Realtime Gateway
                                    │
                                WebSockets


                         ┌──────────────────────┐
                         │        Kafka         │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
       Analysis Worker        Coding Worker        Analytics Worker
              │
              ▼
          Stockfish
              │
              ▼
       Structured Analysis
              │
              ▼
          AI/RAG Worker


                         ┌──────────────────────┐
                         │      AI Platform     │
                         └──────────┬───────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                                     │
                 ▼                                     ▼
          Game Analysis RAG                     Chess Knowledge RAG
                 │                                     │
                 ▼                                     ▼
             Vector DB                              Vector DB
                 │                                     │
                 └──────────────────┬──────────────────┘
                                    ▼
                              RAG Service
                                    │
                              LLM Gateway
                                    │
                   ┌────────────────┼────────────────┐
                   ▼                ▼                ▼
                 Groq             NVIDIA           Gemini
```

---

# 6. Repository Target Structure

The repository should gradually move toward:

```text
CodeMate/
│
├── README.md
│
├── frontend/
│   ├── README.md
│   ├── package.json
│   ├── vite.config.*
│   └── src/
│       ├── app/
│       ├── components/
│       ├── pages/
│       ├── features/
│       │   ├── auth/
│       │   ├── chess/
│       │   ├── games/
│       │   ├── coding/
│       │   ├── ai/
│       │   └── profile/
│       ├── hooks/
│       ├── services/
│       ├── store/
│       ├── types/
│       └── utils/
│
├── backend/
│   ├── README.md
│   ├── package.json
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── modules/
│       │   ├── auth/
│       │   ├── users/
│       │   ├── games/
│       │   ├── chess/
│       │   ├── analysis/
│       │   ├── coding/
│       │   ├── matchmaking/
│       │   └── ai/
│       │
│       ├── infrastructure/
│       │   ├── mongodb/
│       │   ├── redis/
│       │   ├── kafka/
│       │   ├── stockfish/
│       │   ├── judge0/
│       │   └── llm/
│       │
│       ├── sockets/
│       ├── routes/
│       └── server.*
│
├── ai/
│   ├── README.md
│   ├── rag/
│   │   ├── game/
│   │   └── chess/
│   ├── ingestion/
│   ├── embeddings/
│   ├── retrieval/
│   ├── prompts/
│   └── evaluation/
│
├── workers/
│   ├── README.md
│   ├── analysis-worker/
│   ├── ai-worker/
│   ├── coding-worker/
│   └── analytics-worker/
│
├── infrastructure/
│   ├── docker/
│   ├── kafka/
│   ├── redis/
│   ├── qdrant/
│   ├── prometheus/
│   ├── grafana/
│   └── kubernetes/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── events/
│   ├── rag/
│   ├── websocket/
│   └── decisions/
│
├── docker-compose.yml
├── .env.example
└── .github/
    └── workflows/
```

The exact language/file extensions may follow the current repository if it already uses JavaScript rather than TypeScript. Do not migrate languages solely for the sake of migration.

---

# 7. Phase 0 — Repository Audit and Stabilization

Before implementing new features, the coding agent MUST inspect:

- root README
- backend README
- package.json files
- existing source tree
- routes
- controllers
- services
- models
- middleware
- authentication
- database configuration
- Stockfish integration
- existing AI integration
- Docker files
- Kubernetes files
- environment variables
- tests
- existing frontend files

Do not delete working code before understanding it.

Create an internal implementation map:

```text
Existing Feature
→ Existing File
→ Existing API
→ Existing Database Model
→ Existing Dependencies
→ Enhancement Required
```

## Phase 0 goals

- Remove obvious duplication.
- Fix broken imports.
- Improve error handling.
- Add environment validation.
- Add `.env.example`.
- Add structured logging.
- Add API validation.
- Establish consistent response/error formats.
- Preserve existing API compatibility where practical.
- Add/repair tests for important existing functionality.

## Acceptance Criteria

The existing backend must start cleanly.

A developer must be able to:

```bash
npm install
npm run dev
```

and understand what configuration is required.

---

# 8. Phase 1 — Frontend Foundation

Build a complete frontend from scratch if the existing frontend is incomplete.

## Recommended stack

Use the project's existing choices if already established. Otherwise:

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- Zustand where client-side global state is genuinely useful
- chess.js
- react-chessboard or an equivalent maintained chessboard component

Do not add state-management libraries everywhere.

## Required pages

```text
/
 /login
 /register
 /dashboard

 /play
 /play/ai
 /play/local
 /play/online
 /play/online/:gameId

 /games
 /games/:gameId
 /games/:gameId/analysis

 /ai-coach
 /chess-knowledge

 /coding
 /coding/:problemId
 /coding/submissions

 /profile
 /settings
```

## Frontend requirements

Implement:

- authentication
- protected routes
- API client
- loading states
- error states
- empty states
- responsive design
- chessboard
- move history
- timers
- game controls
- game history
- analysis UI
- AI chat
- coding editor
- submission status
- dashboard analytics

---

# 9. Phase 2 — Complete Chess Experience

The chess module must support:

## AI game

- Start game.
- Choose side.
- Choose difficulty.
- Make legal moves.
- Receive AI moves.
- Show game status.
- Save completed game.
- Allow resignation.
- Detect checkmate/stalemate/draw.
- Persist PGN/move history.

## Local game

Two users can play on the same device.

## Game replay

The user should be able to:

- navigate move-by-move
- jump to a move
- return to the current position
- inspect FEN
- inspect evaluation when available

---

# 10. Phase 3 — P2P Multiplayer

Implement real-time chess using WebSockets.

Socket technology may be Socket.IO or native WebSockets depending on the existing architecture.

## Core events

```text
room:create
room:join
room:leave
room:ready

game:start
game:move
game:state
game:resign

draw:offer
draw:accept
draw:reject

game:pause
game:resume
game:finish

player:connected
player:disconnected
player:reconnected
```

## Rules

The server must remain authoritative.

The client must never be trusted to determine:

- whether a move is legal
- whose turn it is
- game result
- remaining server-side time
- player identity

The server validates every move.

---

# 11. Phase 4 — Redis

Redis should initially support:

## 11.1 Live game state

Example conceptual key:

```text
game:{gameId}:state
```

Data:

```json
{
  "gameId": "game123",
  "whitePlayerId": "user1",
  "blackPlayerId": "user2",
  "fen": "...",
  "turn": "white",
  "status": "active"
}
```

## 11.2 Presence

```text
user:{userId}:presence
```

## 11.3 Rooms

```text
room:{roomId}
```

## 11.4 Matchmaking

Use Redis structures suitable for:

- waiting players
- rating ranges
- game mode
- time control

## 11.5 Rate limiting

Use Redis-backed rate limiting for:

- authentication endpoints
- AI requests
- code execution
- chat
- expensive analysis requests

## Important

MongoDB remains the source of truth for durable history.

Redis is not the permanent database for completed games.

---

# 12. Phase 5 — Chess Game Analysis

Stockfish should produce structured analysis rather than only plain text.

For every analyzed move, store information conceptually like:

```json
{
  "moveNumber": 23,
  "fenBefore": "...",
  "fenAfter": "...",
  "playedMove": "Nxe5",
  "bestMove": "d4",
  "evaluationBefore": 0.7,
  "evaluationAfter": -1.1,
  "centipawnLoss": 180,
  "classification": "mistake",
  "principalVariation": ["d4", "..."],
  "themes": ["king_safety", "tactical_motif"]
}
```

Possible classifications:

```text
book
excellent
good
inaccuracy
mistake
blunder
```

The exact thresholds must be configurable rather than hard-coded throughout the codebase.

---

# 13. Phase 6 — Game Analysis RAG

This is one of the two core RAG systems.

## Purpose

The Game Analysis RAG answers:

> "Talk to me about THIS game."

Examples:

- Why was move 23 a mistake?
- What should I have played?
- Where did I lose the advantage?
- Which tactical opportunities did I miss?
- Why was my king unsafe?
- Did I repeat the same mistake?
- What should I learn from this game?

## Game knowledge sources

The retrieval context should combine:

### A. Game metadata

```text
players
result
time control
opening
date
rating
```

### B. Move history

```text
PGN
moves
FENs
```

### C. Stockfish analysis

```text
evaluation
best move
centipawn loss
classification
principal variation
```

### D. Chess knowledge

```text
tactics
strategy
opening principles
endgame principles
```

### E. Player history

Eventually:

```text
recurring mistakes
weaknesses
previous games
```

## Retrieval flow

```text
User Question
      ↓
Query/Intent Classification
      ↓
Identify Game
      ↓
Retrieve Relevant Moves
      ↓
Retrieve Stockfish Findings
      ↓
Retrieve Relevant Chess Knowledge
      ↓
Optional Player Statistics
      ↓
Context Builder
      ↓
LLM
      ↓
Answer
```

The answer should be grounded in the actual game data.

---

# 14. Game Chat UX

When a user opens:

```text
/games/:gameId/analysis
```

provide:

```text
Game Board
+
Move List
+
Analysis
+
AI Chat
```

The AI chat should automatically know:

- current game
- selected move
- position
- move history
- analysis
- user identity
- relevant retrieved knowledge

The user should not have to paste the PGN manually.

---

# 15. "Explain This Move"

Every analyzed mistake/inaccuracy should have:

```text
[Explain with AI]
```

Flow:

```text
Selected Move
     ↓
Position
     ↓
Stockfish Analysis
     ↓
Relevant Chess Knowledge
     ↓
LLM
     ↓
Explanation
```

Example answer structure:

```text
What happened?

Why it is a mistake.

What the stronger move was.

The chess concept involved.

What you should look for next time.

[Practice This Position]
```

---

# 16. "Practice This Mistake"

Every significant mistake should optionally become a training position.

Flow:

```text
Game
 ↓
Mistake
 ↓
Position before mistake
 ↓
Create puzzle
 ↓
User plays best move
 ↓
Evaluate
 ↓
Explain
```

This converts passive game analysis into active learning.

---

# 17. Phase 7 — General Chess Knowledge RAG

This is the second core RAG.

## Purpose

The General Chess RAG answers:

> "Teach me chess."

Examples:

- What is a pin?
- Explain opposition.
- What is Zugzwang?
- Explain the Sicilian Defense.
- When should I castle?
- What is an isolated pawn?
- Explain Lucena position.
- What is a discovered attack?

This RAG must be independent from any specific user's game.

---

# 18. Chess Knowledge Corpus

Organize the source material into categories:

```text
chess-knowledge/
│
├── fundamentals/
│   ├── rules
│   ├── notation
│   └── special_moves
│
├── tactics/
│   ├── fork
│   ├── pin
│   ├── skewer
│   ├── discovered_attack
│   ├── double_attack
│   ├── deflection
│   ├── decoy
│   ├── overload
│   └── zwischenzug
│
├── strategy/
│   ├── center
│   ├── king_safety
│   ├── pawn_structure
│   ├── weak_squares
│   ├── outposts
│   ├── open_files
│   └── piece_activity
│
├── openings/
│
├── middlegame/
│
└── endgames/
    ├── king_pawn
    ├── rook
    ├── bishop
    ├── knight
    └── queen
```

Use legally usable/referenceable source material.

Do not ingest copyrighted books in a way that violates licensing.

---

# 19. RAG Ingestion Pipeline

The ingestion pipeline should be separate from runtime chat.

```text
Documents
    ↓
Document Loader
    ↓
Text Cleaning
    ↓
Chunking
    ↓
Metadata Enrichment
    ↓
Embedding Model
    ↓
Vector Database
```

Each chunk should have metadata such as:

```json
{
  "documentId": "doc123",
  "source": "rook_endgames.md",
  "topic": "endgame",
  "subcategory": "rook",
  "difficulty": "intermediate",
  "section": "Lucena"
}
```

---

# 20. Vector Database

Preferred architecture:

```text
MongoDB
   +
Qdrant
```

MongoDB:

- users
- games
- analysis
- coding problems
- submissions
- chat metadata

Qdrant:

- chess knowledge embeddings
- game knowledge embeddings if vectorized
- future coding knowledge embeddings

If MongoDB Vector Search is already configured and performs adequately, it is acceptable to use it instead of Qdrant.

Do not introduce both Qdrant and MongoDB Vector Search for the same workload without a clear reason.

---

# 21. RAG Retrieval Pipeline

Runtime:

```text
User Query
    ↓
Query Classification
    ↓
Embedding
    ↓
Vector Search
    ↓
Metadata Filtering
    ↓
Top-K Retrieval
    ↓
Optional Reranking
    ↓
Context Construction
    ↓
LLM
    ↓
Answer
```

The system should return source metadata where appropriate.

Example:

```text
Answer...

Sources:
- Chess Fundamentals / King Safety
- Endgame Principles / Opposition
```

---

# 22. Hybrid RAG

Some questions need both RAG systems.

Example:

> Why did I lose my rook in this game?

Use:

```text
Game RAG
+
Chess Knowledge RAG
```

Routing:

```text
Question
   ↓
Intent Router
   ├── General knowledge → Chess RAG
   ├── Specific game → Game RAG
   └── Mixed → Game RAG + Chess RAG
```

Do not force every query through both systems.

---

# 23. Phase 8 — LLM Gateway

Never tightly couple business logic to a single LLM provider.

Create an abstraction:

```text
LLM Gateway
│
├── Groq Provider
├── NVIDIA Provider
├── Gemini Provider
└── Future Provider
```

Application code should conceptually call:

```javascript
llm.generate(...)
```

rather than:

```javascript
groq.generate(...)
```

## Provider configuration

Support environment-driven configuration:

```text
LLM_PROVIDER=groq
LLM_MODEL=...
```

The exact model names must be configurable.

Never hard-code API keys.

---

# 24. LLM Routing

Eventually support task-based routing:

```text
Simple chess question
        ↓
smaller/cheaper model

Game explanation
        ↓
medium model

Complex personalized analysis
        ↓
stronger model
```

The router should be configurable.

Do not make the routing logic dependent on one vendor.

---

# 25. AI Safety / Grounding Rules

The AI must distinguish:

```text
Stockfish fact
Chess knowledge
LLM explanation
LLM inference
```

The LLM must not invent a move evaluation.

If Stockfish says:

```text
evaluation = -1.2
```

the generated explanation may explain it, but must not replace the numeric evaluation with an invented value.

The system should prefer:

```text
"Stockfish evaluated..."
```

when reporting engine results.

---

# 26. Phase 9 — Kafka Event Architecture

Kafka should be introduced for asynchronous processing.

Do not use Kafka for every API call.

## Initial topics

```text
codemate.game.created
codemate.game.move
codemate.game.finished

codemate.analysis.requested
codemate.analysis.completed

codemate.code.submitted
codemate.code.completed

codemate.ai.chat.requested
codemate.ai.chat.completed
```

Later:

```text
codemate.matchmaking.requested
codemate.matchmaking.matched
codemate.rating.updated
codemate.achievement.unlocked
```

---

# 27. Event Design

Events should contain enough information for consumers without putting huge documents into Kafka.

Example:

```json
{
  "eventId": "uuid",
  "eventType": "game.finished",
  "version": 1,
  "timestamp": "ISO-8601",
  "payload": {
    "gameId": "game123",
    "whitePlayerId": "user1",
    "blackPlayerId": "user2",
    "result": "1-0"
  }
}
```

Use versioned event contracts.

---

# 28. Async Game Analysis

Preferred flow:

```text
Game Finished
      ↓
Persist Game
      ↓
Publish game.finished
      ↓
Analysis Consumer
      ↓
Stockfish
      ↓
Persist Structured Analysis
      ↓
Publish analysis.completed
      ↓
AI/RAG Consumer
      ↓
Generate AI Summary
      ↓
Persist Summary
```

The user should not have to wait synchronously for all analysis.

Frontend should show:

```text
Analysis Status

✓ Game saved
✓ Engine analysis completed
⏳ AI coach report
```

---

# 29. Coding Platform Enhancement

Complete the coding side without letting it become disconnected from chess.

Required functionality:

```text
Problem list
Problem details
Difficulty
Tags
Code editor
Language selection
Submit
Execution
Compilation result
Test result
Submission history
```

Use Judge0 or an equivalent sandboxed execution service.

Never execute arbitrary user code directly inside the main backend process.

---

# 30. Coding Service Architecture

Preferred:

```text
Frontend
   ↓
Coding API
   ↓
Submission record
   ↓
Kafka: code.submitted
   ↓
Coding Worker
   ↓
Judge0
   ↓
Result
   ↓
Kafka: code.completed
   ↓
Database
   ↓
Frontend
```

---

# 31. Personalized AI Coach

Once enough data exists, create:

```text
AI Chess Coach
```

Inputs:

```text
Recent games
Game analyses
Mistake categories
Opening performance
Tactical performance
Endgame performance
Time management
Rating history
Practice results
```

Output:

```text
Strengths
Weaknesses
Recurring mistakes
Recommended concepts
Recommended puzzles
Training plan
Progress
```

Example:

```text
Your recent games show repeated problems in rook endgames.

Recommended:
1. Opposition
2. Lucena position
3. Philidor position
4. Rook endgame puzzles
```

This feature must be evidence-based from stored user data rather than generic AI advice.

---

# 32. Chess Puzzle Generator

Generate puzzles from real user mistakes.

Flow:

```text
Analyzed Game
      ↓
Find significant mistake
      ↓
Position before mistake
      ↓
Determine best move
      ↓
Create puzzle
      ↓
Store puzzle
```

Puzzle record should contain:

```text
sourceGameId
sourceMoveNumber
fen
sideToMove
expectedMove
theme
difficulty
```

---

# 33. Dashboard

The dashboard should provide a unified view.

## Chess

```text
Rating
Games
Win rate
Accuracy
Average centipawn loss
Opening statistics
Mistake distribution
```

## Coding

```text
Problems solved
Acceptance rate
Languages
Difficulty distribution
Recent submissions
```

## AI

```text
Games analyzed
AI questions
Most discussed concepts
Training recommendations
```

---

# 34. Skill Analytics

Eventually classify chess mistakes:

```text
Opening
Tactics
Strategy
King Safety
Calculation
Endgame
Time Management
```

Show trends over time.

Example:

```text
Tactics
↑ improving

Endgame
→ stable

Time Management
↓ needs attention
```

Do not generate unsupported conclusions. Analytics must be based on stored metrics.

---

# 35. Matchmaking

Eventually support:

```text
Quick Match
Rated Match
Casual Match
Friend Match
Private Room
```

Matchmaking can use Redis.

Conceptual flow:

```text
Player enters queue
      ↓
Redis queue
      ↓
Match by:
- rating range
- time control
- mode
      ↓
Create game
      ↓
Notify both clients
```

Start with a simple rating range.

Do not build a sophisticated rating algorithm before basic matchmaking works.

---

# 36. Rating System

If implementing rating:

- Keep rating logic isolated.
- Store rating history.
- Store game result.
- Make rating calculations deterministic.
- Add tests.
- Do not allow client-side rating updates.

A standard Elo implementation is sufficient initially.

---

# 37. WebSocket Reliability

P2P multiplayer must support:

- reconnect
- duplicate message protection
- authoritative server state
- room cleanup
- disconnect handling
- heartbeat/ping
- stale room cleanup
- idempotent move processing

A client should be able to reconnect and receive:

```text
current game state
current position
turn
clock state
opponent presence
game status
```

---

# 38. Security Requirements

Implement:

- password hashing
- JWT/session security
- authentication middleware
- authorization
- request validation
- rate limiting
- CORS configuration
- secure HTTP headers
- input sanitization
- WebSocket authentication
- API key protection
- secret management
- safe code execution through external sandbox
- ownership checks for games and private resources

Never trust:

```text
userId
gameId
move
rating
result
analysis
```

coming from an untrusted client.

---

# 39. Database Design

Maintain clear separation.

## User

```text
User
- _id
- username
- email
- passwordHash
- chessRating
- codingStats
- preferences
- createdAt
- updatedAt
```

## Game

```text
Game
- _id
- mode
- whitePlayer
- blackPlayer
- result
- status
- moves
- pgn
- initialFen
- finalFen
- timeControl
- opening
- createdAt
- completedAt
```

## Game Analysis

```text
GameAnalysis
- gameId
- engineVersion
- summary
- moveAnalyses
- mistakeCount
- blunderCount
- inaccuracyCount
- accuracy
- themes
- status
```

## Coding Problem

```text
CodingProblem
- title
- description
- difficulty
- tags
- constraints
- examples
- starterCode
- testCases
```

## Submission

```text
Submission
- userId
- problemId
- language
- code
- status
- executionTime
- memory
- testResults
- createdAt
```

Exact schema should follow the current implementation where possible.

---

# 40. Caching Strategy

Use Redis for expensive or frequently requested data.

Possible caches:

```text
game:{id}:state
user:{id}:profile
opening:{position}
leaderboard:{period}
ai:response:{hash}
```

AI response caching should be used carefully.

Do not cache responses that are highly personalized unless the cache key includes all relevant context.

---

# 41. API Design

Use consistent APIs.

Example:

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/users/me

POST   /api/games
GET    /api/games
GET    /api/games/:id
POST   /api/games/:id/resign

GET    /api/games/:id/analysis
POST   /api/games/:id/analyze

POST   /api/games/:id/chat
POST   /api/games/:id/mistakes/:move/practice

POST   /api/chess/chat

GET    /api/coding/problems
GET    /api/coding/problems/:id
POST   /api/coding/submissions

GET    /api/dashboard
GET    /api/users/me/statistics
```

Exact endpoints may differ according to the existing backend.

Do not break existing endpoints unnecessarily.

---

# 42. AI API Separation

Prefer:

```text
POST /api/games/:gameId/chat
```

for game-specific AI.

And:

```text
POST /api/chess/chat
```

for general chess knowledge.

This keeps the two RAG systems conceptually separate.

---

# 43. Observability

After the core application is stable, add:

```text
OpenTelemetry
Prometheus
Grafana
```

Track:

```text
HTTP latency
HTTP errors
WebSocket connections
active games
Kafka consumer lag
Redis latency
Stockfish analysis duration
RAG retrieval latency
LLM latency
LLM errors
Judge0 latency
```

Use correlation/request IDs.

---

# 44. Docker

Local development should eventually support:

```bash
docker compose up
```

with services approximately:

```text
frontend
backend
mongodb
redis
kafka
zookeeper or Kafka KRaft equivalent
qdrant
```

Do not containerize unnecessary components if the development environment already provides them reliably.

---

# 45. Kubernetes

Kubernetes is a later phase.

Potential workloads:

```text
frontend
api
realtime
analysis-worker
ai-worker
coding-worker
```

Stateful infrastructure should only be self-hosted in Kubernetes if there is a clear reason.

For a portfolio project, managed services may be preferable in production.

---

# 46. CI/CD

Add GitHub Actions for:

```text
install
lint
test
build
Docker build
```

Later:

```text
security scanning
image scanning
deployment
```

Every pull request should at least verify:

```text
Backend builds
Frontend builds
Tests pass
```

---

# 47. Testing Strategy

## Unit Tests

Test:

- chess rules/business logic
- rating
- analysis classification
- RAG routing
- event creation
- validation
- utility functions

## Integration Tests

Test:

- authentication
- game creation
- game persistence
- analysis pipeline
- Redis integration
- Kafka consumers
- RAG retrieval

## WebSocket Tests

Test:

- room creation
- joining
- move validation
- duplicate moves
- reconnect
- disconnect
- game completion

## Frontend Tests

Test:

- authentication flow
- chessboard interaction
- game state
- analysis rendering
- AI chat
- coding submission state

---

# 48. Documentation Requirements

Maintain:

```text
README.md
backend/README.md
ai/README.md
```

and:

```text
docs/
├── architecture/
│   ├── overview.md
│   ├── data-flow.md
│   └── service-boundaries.md
│
├── api/
│   └── api.md
│
├── events/
│   └── kafka-events.md
│
├── websocket/
│   └── protocol.md
│
└── rag/
    ├── game-rag.md
    └── chess-rag.md
```

The root README is product-focused.

The backend README is implementation-focused.

The AI README explains RAG, embeddings, retrieval and LLM architecture.

---

# 49. Development Phases — Exact Order

## Phase 0
Repository audit + stabilization.

## Phase 1
Frontend foundation.

## Phase 2
Complete Chess AI + Local gameplay.

## Phase 3
Game persistence + replay + analysis UI.

## Phase 4
P2P WebSocket multiplayer.

## Phase 5
Redis for live state/presence/matchmaking/cache.

## Phase 6
Structured Stockfish analysis.

## Phase 7
Game Analysis RAG.

## Phase 8
General Chess Knowledge RAG.

## Phase 9
LLM Gateway + provider abstraction.

## Phase 10
Kafka + asynchronous workers.

## Phase 11
Coding platform + Judge0.

## Phase 12
Personalized AI Chess Coach.

## Phase 13
Puzzle generation + training.

## Phase 14
Analytics + dashboard.

## Phase 15
Extract services into microservices.

## Phase 16
Docker hardening + Kubernetes.

## Phase 17
Observability + CI/CD.

Do not skip ahead simply to use a technology.

---

# 50. Microservice Extraction Strategy

Once the modular monolith is stable, identify actual boundaries.

Potential services:

```text
auth-service
user-service
game-service
realtime-service
analysis-service
coding-service
ai-service
analytics-service
```

Possible responsibilities:

### Auth Service

- registration
- login
- tokens
- authentication

### User Service

- profile
- preferences
- statistics

### Game Service

- games
- moves
- results
- PGN
- history

### Realtime Service

- WebSockets
- rooms
- presence
- live state coordination

### Analysis Service

- Stockfish
- game analysis
- analysis jobs

### Coding Service

- problems
- submissions
- Judge0 integration

### AI Service

- RAG
- LLM gateway
- chat
- AI coach

### Analytics Service

- aggregation
- dashboards
- metrics

Do not create a service if its independent scaling/deployment/ownership does not provide a meaningful benefit.

---

# 51. Service Communication Rules

Use synchronous HTTP when:

```text
The caller needs an immediate response.
```

Use Kafka when:

```text
The operation can happen asynchronously.
```

Use WebSockets when:

```text
The client needs real-time bidirectional communication.
```

Use Redis when:

```text
The data is temporary, frequently accessed, or coordination-related.
```

Use MongoDB when:

```text
The data needs durable persistence.
```

Use the vector database when:

```text
Semantic retrieval is required.
```

---

# 52. Error Handling

Every service must use predictable error responses.

Conceptual format:

```json
{
  "success": false,
  "error": {
    "code": "GAME_NOT_FOUND",
    "message": "Game not found"
  },
  "requestId": "..."
}
```

Do not expose:

- stack traces
- API keys
- database credentials
- internal service details

to clients in production mode.

---

# 53. Configuration

Create:

```text
.env.example
```

Possible variables:

```text
NODE_ENV=

PORT=

MONGODB_URI=

JWT_SECRET=

REDIS_URL=

KAFKA_BROKERS=

VECTOR_DB_URL=

VECTOR_DB_API_KEY=

LLM_PROVIDER=
LLM_MODEL=

GROQ_API_KEY=
NVIDIA_API_KEY=
GEMINI_API_KEY=

JUDGE0_URL=

STOCKFISH_PATH=
```

Only include variables actually used by the project.

Never commit real secrets.

---

# 54. Frontend UX Requirements

The application must feel like one coherent product.

Use consistent:

- typography
- spacing
- buttons
- cards
- loading states
- notifications
- modal behavior
- error messages

Important states must have UI:

```text
loading
empty
error
success
processing
offline
reconnecting
```

P2P games must visibly show:

```text
Connected
Reconnecting...
Opponent disconnected
Opponent reconnected
```

---

# 55. AI UX Requirements

Avoid generic "ChatGPT clone" behavior.

AI interactions should be contextual.

### Game AI

```text
Current game
Current move
Current position
Engine analysis
Player history
```

### Chess Knowledge AI

```text
Chess knowledge corpus
Sources
Difficulty/context
```

### AI Coach

```text
Player statistics
Game history
Recurring weaknesses
Training history
```

---

# 56. Performance Requirements

Avoid unnecessary expensive work.

Examples:

- Do not run Stockfish after every UI render.
- Do not call an LLM when a deterministic answer is available.
- Do not generate embeddings repeatedly for the same document.
- Do not send full game history to an LLM if only a few moves are relevant.
- Cache appropriate results.
- Use asynchronous processing for long operations.
- Paginate game history and coding submissions.
- Stream AI responses where useful.

---

# 57. RAG Quality Requirements

RAG quality matters more than simply having a vector database.

Measure:

```text
retrieval relevance
answer groundedness
source correctness
latency
token usage
```

Create a small evaluation dataset:

```text
question
expected concepts
expected source
```

Test the retrieval pipeline against it.

---

# 58. Prompt Design

Prompts must be maintained separately from business logic.

Example structure:

```text
ai/
└── prompts/
    ├── game-analysis.md
    ├── game-chat.md
    ├── chess-chat.md
    └── coach.md
```

Do not scatter huge prompt strings throughout controllers.

---

# 59. AI Response Contract

Prefer structured AI output internally.

Conceptually:

```json
{
  "answer": "...",
  "keyConcepts": [
    "king safety",
    "overloaded defender"
  ],
  "recommendations": [
    "Practice tactical positions"
  ],
  "sources": [
    {
      "title": "...",
      "section": "..."
    }
  ]
}
```

The exact schema may evolve.

Validate LLM output before storing/returning it.

---

# 60. Do Not Overengineer

The coding agent MUST follow these rules:

1. Do not rewrite working modules without reason.
2. Do not create microservices prematurely.
3. Do not add Kafka to synchronous CRUD.
4. Do not store permanent game history only in Redis.
5. Do not use LLMs where deterministic logic is better.
6. Do not use RAG for simple database lookups.
7. Do not introduce multiple vector databases without a requirement.
8. Do not duplicate business logic between frontend and backend.
9. Do not trust client-side game state.
10. Do not expose secrets.
11. Do not silently break existing APIs.
12. Do not replace a working dependency without a clear benefit.
13. Do not implement every future feature before finishing the current phase.

---

# 61. Definition of Done for Each Phase

A phase is complete only when:

```text
Implementation exists
+
Tests exist for important behavior
+
Frontend integration exists where relevant
+
Error handling exists
+
Documentation is updated
+
Environment configuration is documented
+
Existing functionality still works
```

Do not mark a feature complete merely because the code compiles.

---

# 62. Coding Agent Operating Procedure

For every task:

## Step 1 — Inspect

Read:

- relevant README
- package.json
- target module
- dependencies
- related models/routes/services
- tests

## Step 2 — Understand

Explain internally:

```text
Current behavior
Current data flow
Required change
Potential breaking points
```

## Step 3 — Design

Before modifying multiple files, determine:

```text
Files to change
Files to create
API changes
Database changes
Event changes
Frontend changes
```

## Step 4 — Implement

Make small, coherent changes.

## Step 5 — Validate

Run:

```text
lint
tests
build
```

as applicable.

## Step 6 — Verify Integration

Check that the feature works end-to-end.

## Step 7 — Document

Update relevant README/docs.

---

# 63. Feature Implementation Format for the Coding Agent

For every major feature, maintain this internal checklist:

```text
Feature:
Purpose:

Existing code:
- ...

Backend:
- routes
- controller
- service
- model

Frontend:
- page
- component
- state
- API integration

Infrastructure:
- Redis?
- Kafka?
- Vector DB?
- Worker?

Tests:
- unit
- integration
- e2e

Documentation:
- README
- architecture
- API/events
```

---

# 64. Recommended First Implementation Sprint

Do NOT start with Kafka or Kubernetes.

First accomplish:

```text
1. Audit current repository
2. Stabilize backend
3. Create frontend
4. Connect authentication
5. Build dashboard
6. Build chess game screen
7. Connect existing APIs
8. Save/replay games
9. Improve Stockfish analysis
10. Build analysis page
```

After this, the application becomes visibly usable.

Then:

```text
11. P2P WebSockets
12. Redis
13. Game RAG
14. Chess RAG
15. Kafka
```

---

# 65. Final Product Goal

The final CodeMate product should feel like:

```text
                 CODEMATE

          CHESS × CODE × AI

       Play → Analyze → Learn
                ↓
          Practice Mistakes
                ↓
        Personalized Coaching
                ↓
          Improve Over Time
```

The application should combine:

```text
REAL-TIME CHESS
      +
STOCKFISH
      +
AI GAME ANALYSIS
      +
CHESS KNOWLEDGE RAG
      +
PERSONALIZED AI COACH
      +
CODING CHALLENGES
      +
P2P MULTIPLAYER
      +
EVENT-DRIVEN BACKEND
```

The purpose of the architecture is not to demonstrate that many technologies were used.

The purpose is to demonstrate that each technology was used because the product genuinely benefits from it.

---

# 66. Final Target Architecture Summary

```text
                         CODEMATE
                            │
                 ┌──────────┴──────────┐
                 │                     │
              Frontend               Backend
                 │                     │
          React + TypeScript      API Gateway
                 │                     │
                 │       ┌─────────────┼─────────────┐
                 │       │             │             │
                 │     Auth           Games        Coding
                 │       │             │             │
                 │       │          Redis           │
                 │       │             │            Judge0
                 │       │        WebSockets
                 │       │             │
                 │       └──────┬──────┘
                 │              │
                 │            Kafka
                 │              │
                 │       ┌──────┼────────┐
                 │       │      │        │
                 │    Analysis  AI    Analytics
                 │       │      │
                 │   Stockfish  │
                 │              │
                 │        ┌─────┴─────┐
                 │        │           │
                 │    Game RAG    Chess RAG
                 │        │           │
                 │        └─────┬─────┘
                 │              │
                 │          Vector DB
                 │              │
                 │         LLM Gateway
                 │              │
                 │      ┌───────┼───────┐
                 │      │       │       │
                 │    Groq    NVIDIA  Gemini
                 │
                 └──────────────────────────────
```

---

# 67. Success Criteria

The enhancement is successful when a new developer can clone CodeMate and understand:

1. What CodeMate does.
2. How the frontend communicates with the backend.
3. How chess games work.
4. How P2P games work.
5. Why Redis exists.
6. Why Kafka exists.
7. How Stockfish analysis works.
8. How Game RAG works.
9. How Chess Knowledge RAG works.
10. How the LLM provider abstraction works.
11. How coding submissions work.
12. How asynchronous workers work.
13. How the system can evolve into microservices.
14. How to run the project locally.
15. How to test it.
16. How to deploy it.

The final system should be **functional first, scalable second, distributed third**.

That order is intentional.

---

# 68. Immediate Next Task

The first coding-agent task should be:

> **Audit the current CodeMate repository against this enhancement specification. Do not implement the entire specification at once. Produce a gap analysis identifying what already exists, what is partially implemented, what is broken, and what needs to be created. Then propose the exact Phase 0 and Phase 1 file-level implementation plan.**

After the audit is approved, implement Phase 0 and Phase 1 before proceeding to later phases.

---

## Engineering Principle

> **Build the product first. Introduce architecture when the product creates a reason for that architecture.**

CodeMate should ultimately be a strong demonstration of:

**AI + RAG + Chess + Coding + Real-Time Systems + Distributed Systems + Modern Full-Stack Engineering.**
