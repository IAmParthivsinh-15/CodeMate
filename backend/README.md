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

```
backend/
├── config/
│   └── db.js               # MongoDB connection configuration
├── controller/
│   ├── admin.js            # Admin controllers
│   ├── auth.js             # Authentication controllers
│   ├── game.js             # Game logic controllers
│   ├── gameAnalysis.js     # Game analysis controllers
│   ├── codingQuestions.js  # Coding problems controllers
│   └── codeExecution.js    # Code execution controllers
├── engine/
│   ├── stockfish           # Linux Stockfish executable
│   └── stockfish.exe       # Windows Stockfish executable
├── k8s/
│   ├── configmap.yaml      # Kubernetes ConfigMap
│   ├── deployment.yaml     # Kubernetes Deployment
│   ├── secret.yaml         # Kubernetes Secrets
│   └── service.yaml        # Kubernetes Service
├── model/
│   ├── admin.js           # Admin model
│   ├── codingQuestion.js  # Coding question model
│   ├── gameAnalysis.js    # Game analysis model
│   ├── gameSession.js     # Game session model
│   └── user.js           # User model
├── routes/
│   ├── admin.js          # Admin routes
│   ├── auth.js          # Authentication routes
│   ├── code.js         # Code execution routes
│   ├── game.js        # Game routes
│   └── gameAnalysis.js # Analysis routes
├── services/
│   ├── chessEngine.js    # Chess engine service
│   ├── codeExecutor.js   # Code execution service
│   └── geminiService.js  # AI analysis service
└── server.js             # Main application entry
```

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

Required in `.env`:
```
PORT=port
MONGO_URL=your_mongodb_url
ACCESS_TOKEN_SECRET=your_secret
REFRESH_TOKEN_SECRET=your_secret
JUDGE0_API_URL=your_judge0_url
JUDGE0_API_KEY=your_judge0_key
GEMINI_API_KEY=your_gemini_key
```

## 🚀 API Endpoints

### Chess Routes
```
POST /api/game/start      - Start new game
POST /api/game/move      - Make move
POST /api/game/analysis  - Analyze game
GET  /api/game/history  - Get game history
```

### Coding Routes
```
POST /api/code/execute    - Execute code
GET  /api/questions      - Get coding questions
POST /api/questions/add  - Add new question
```

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

# Kubernetes
kubectl apply -f k8s/
```

