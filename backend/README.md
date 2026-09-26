# CodeMate Backend

A comprehensive learning platform combining chess gaming and coding challenges, built with Node.js, Express, MongoDB, Stockfish engine, and Google's Gemini AI.

## 🚀 Technology Stack

- **Runtime**: Node.js v20.11.1
- **Framework**: Express.js
- **Database**: MongoDB
- **Chess Engine**: Stockfish
- **AI Assistant**: Google Gemini Pro
- **Authentication**: JWT (Access & Refresh Tokens)
- **Container**: Docker
- **Orchestration**: Kubernetes

## 📁 Project Structure

The backend is a **modular monolith**: code is grouped by feature, not by layer. See [ADR 0001](../docs/decisions/0001-modular-monolith-layout.md) for the reasoning.

```
backend/
├── engine/
│   ├── stockfish                      # Linux Stockfish executable
│   └── stockfish.exe                  # Windows Stockfish executable
├── src/
│   ├── server.js                      # Entry point: loads .env, connects MongoDB, starts HTTP
│   ├── routes/
│   │   └── index.js                   # Mounts every module router at its URL prefix
│   ├── middleware/
│   │   ├── auth.js                    # protectRoutes / protectAdminRoutes (JWT)
│   │   └── checkRole.js               # Role guard (admin / superadmin)
│   ├── modules/
│   │   ├── auth/                      # register, login, refresh, logout, me + JWT helpers (tokens.js)
│   │   ├── users/                     # User model
│   │   ├── admin/                     # Admin model, login, add-admin
│   │   ├── games/                     # GameSession model, start / save / end, bot move
│   │   ├── chess/                     # Engine debug endpoint
│   │   ├── analysis/                  # GameAnalysis model, Stockfish + Gemini analysis
│   │   └── coding/                    # CodingQuestion model, questions, code execution
│   └── infrastructure/
│       ├── mongodb/connection.js      # Mongoose connection
│       ├── stockfish/chessEngine.js   # UCI wrapper around the Stockfish binary
│       ├── judge0/codeExecutor.js     # Judge0 (RapidAPI) client
│       └── llm/geminiService.js       # Gemini report generation
├── .env.example                       # Required environment variables
└── Dockerfile
```

Kubernetes manifests are at [`infrastructure/kubernetes/`](../infrastructure/kubernetes/) in the repo root.

> Run the server from `backend/`. `npm start` and `npm run dev` already do this, and the Stockfish binary is found relative to the current working directory.

## 🎮 Chess Features

### Game Analysis
- Real-time position evaluation
- Move accuracy calculation
- Best move suggestions
- AI-powered game reports
- Historical analysis storage

### Difficulty Levels
- Beginner (ELO ~1000)
- Intermediate (ELO ~1500)
- Advanced (ELO ~1800)
- Master (ELO ~2100)
- Grandmaster (ELO ~2400)
- Legendary (ELO ~2700)

## 💻 Coding Features

### Code Execution
- Multiple language support (JavaScript, Python, Java, C++)
- Real-time compilation and execution
- Test case validation
- Performance metrics

### Problem Difficulty
- Beginner
- Intermediate
- Advanced
- Master
- Grandmaster
- Legendary

## 🤖 AI Integration

### Game Analysis
```javascript
{
  "summary": "Game analysis summary",
  "strengths": ["Positional play", "Endgame technique"],
  "weaknesses": ["Tactical awareness", "Time management"],
  "keyInsights": [
    {
      "moveNumber": 15,
      "playerMove": "e4",
      "bestMove": "d4",
      "explanation": "Strategic explanation"
    }
  ],
  "trainingRecommendations": ["Focus areas"]
}
```

## 📊 Database Schemas

### Game Analysis Model
```javascript
{
  gameSession: ObjectId,
  playerAccuracy: Number,
  computerAccuracy: Number,
  bestMoveCount: Number,
  inaccuracies: Number,
  mistakes: Number,
  blunders: Number,
  moveAnalysis: [{
    moveNumber: Number,
    playerMove: String,
    bestMove: String,
    accuracy: Number,
    classification: String,
    fenBefore: String,
    fenAfter: String,
    evaluationBefore: Number,
    evaluationAfter: Number
  }],
  geminiReport: {
    summary: String,
    strengths: [String],
    weaknesses: [String],
    keyInsights: Array,
    trainingRecommendations: [String]
  }
}
```

## 🔑 Environment Variables

Copy [`.env.example`](./.env.example) to `.env` and fill it in. Never commit `.env`.

| Variable | Required | Used by |
| :-- | :-- | :-- |
| `PORT` | yes | HTTP server |
| `MONGO_URL` | yes | MongoDB connection |
| `ACCESS_TOKEN_SECRET` | yes | Access JWT signing and verification |
| `ACCESS_TOKEN_EXPIRES_IN` | no (default `15m`) | Access JWT lifetime |
| `REFRESH_TOKEN_SECRET` | yes | Refresh JWT signing and verification |
| `REFRESH_TOKEN_EXPIRES_IN` | yes | Refresh JWT lifetime |
| `JUDGE0_API_URL` | for code execution | Judge0 base URL |
| `JUDGE0_API_KEY` | for code execution | RapidAPI key |
| `GEMINI_API_KEY` | for AI reports | Gemini client |
| `NODE_ENV` | no | Adds error details to code-execution failures when `development` |

## 🚀 API Endpoints

The full, current reference is in [docs/api/api.md](../docs/api/api.md).

| Prefix | Module |
| :-- | :-- |
| `/api/auth` | register, login, refresh, logout, me |
| `/api/admin` | admin login, add admin |
| `/api/game` | start, save, end |
| `/api/game-analysis` | analyze |
| `/api/coding-questions` | add-question, get-a-question |
| `/api/code` | execute |

Known defects and the plan to fix them: [gap analysis](../docs/architecture/gap-analysis.md), [Phase 0/1 plan](../docs/architecture/phase-0-1-plan.md).

## 🔄 Development

1. Install dependencies:
```bash
npm install
```

2. Setup environment:
```bash
cp .env.example .env
# Update environment variables
```

3. Start server:
```bash
npm run dev
```

## 🐳 Docker & Kubernetes

Build and deploy:
```bash
# Docker
docker build -t codemate-backend .
docker run -p 5050:5050 codemate-backend

# Kubernetes (from the repo root)
kubectl apply -f infrastructure/kubernetes/
```

`infrastructure/kubernetes/secret.yaml` is gitignored. Create it locally with your own base64-encoded values, and never commit it.

