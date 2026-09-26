# CodeMate ♟️<>💻

> Where Chess Strategy Meets Coding Prowess.

CodeMate is a unique, gamified platform designed for individuals who love the intellectual challenge of both chess and programming. It merges the strategic world of chess with the problem-solving realm of coding, creating a one-of-a-kind training ground for your mind.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)

---

## ✨ Core Concept

Ever been stuck in a chess game, wishing for a hint? In CodeMate, you don't just get one—you **earn** it.

When playing against our AI bot, you can request a hint for the best next move. To unlock it, you must solve a randomly assigned coding challenge. Your code is submitted and validated in real-time. If you succeed, the Stockfish engine provides you with a strategic move. Fail, and you're back to the board on your own!

This core loop turns every game into a dynamic test of both your logical and strategic skills.

## 🚀 Key Features

*   **Play Chess**: Enjoy a clean chess interface to play against our powerful bot or in a classic pass-and-play mode with a friend.
*   **Code for a Hint**: The signature feature. When playing the bot, solve a coding problem to receive a hint from the world-class Stockfish chess engine.
*   **Real-time Code Evaluation**: Code submissions are planned to be evaluated instantly using the **Judge0** API, supporting multiple programming languages.
*   **User Profiles & Analytics**: (Upcoming) Track your chess ELO, your coding problem success rate, and see detailed performance analysis.

## 🎮 Chess Features

### Game Analysis
- Real-time position evaluation using Stockfish
- Move accuracy calculation and classification
- Best move suggestions with explanations
- AI-powered game reports via Google Gemini
- Historical analysis storage and replay

### Difficulty Levels
- 🌱 Beginner (ELO ~1000)
- 📚 Intermediate (ELO ~1500)
- 🎯 Advanced (ELO ~1800)
- 🏆 Master (ELO ~2100)
- 👑 Grandmaster (ELO ~2400)
- ⚡ Legendary (ELO ~2700)

## 💻 Coding Challenge System

### Supported Languages
- JavaScript/Node.js
- Python
- Java
- C++

### Challenge Categories
- Arrays & Strings
- Dynamic Programming
- Graph Algorithms
- Data Structures
- Algorithmic Puzzles

### Difficulty Progression
- Each difficulty level unlocks progressively
- Hints cost increases with difficulty
- Special achievements for no-hint victories

## 🤖 AI Integration

### Chess Analysis
```json
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
  "recommendations": ["Training suggestions"]
}
```

### Code Analysis
- Syntax validation
- Time complexity analysis
- Space complexity feedback
- Code style recommendations
- Alternative solution suggestions

## 📊 Project Status

The project is divided into a backend service and a frontend client.

### ✅ Backend (Functionally Complete)

The backend is robust and ready. It handles all core logic, from user authentication to chess game state management.

*   **Tech Stack**: Node.js, Express.js, MongoDB
*   **Features**:
    *   Secure User Authentication (JWT)
    *   Full Chess Game Logic (move validation, check/checkmate detection)
    *   Game State Management & Database Integration
    *   **Stockfish Engine Integrated** for bot moves.
*   **DevOps**: The entire backend is containerized with **Docker** and orchestrated using **Kubernetes** for scalability and reliability.

> For a deep dive into the API, architecture, and setup, please see the **[backend/README.md](./backend/README.md)**.

### 🔜 Frontend (Planned)

The user interface is the next major milestone.

*   **Tech Stack**: React with TypeScript
*   **Status**: Development has not yet begun. The focus is on building a clean, intuitive, and responsive UI.
*   **Planned Features**:
    *   Chessboard interface
    *   User profile section
    *   Statistics and game history tracking
    *   In-game code editor

## 🗂️ Repository Layout

```text
CodeMate/
├── backend/                 # Node.js + Express API (modular monolith): see backend/README.md
├── frontend/                # React + TypeScript + Vite client (Phase 1)
├── infrastructure/
│   └── kubernetes/          # Deployment, Service, ConfigMap (secret.yaml is local-only)
├── docs/
│   ├── architecture/        # Gap analysis and the phase-by-phase implementation plan
│   ├── api/                 # Current REST API reference
│   └── decisions/           # Architecture decision records (ADRs)
└── ENHANCEMENT.md           # The engineering specification this project is evolving towards
```

New top-level folders (`ai/`, `workers/`, and more under `infrastructure/`) are added in the phase that first needs them. Current status and known gaps: **[docs/architecture/gap-analysis.md](./docs/architecture/gap-analysis.md)**.

## 🛠️ Tech Stack & Tools

| Area      | Technology                                    |
| :-------- | :-------------------------------------------- |
| **Frontend**  | React, TypeScript                             |
| **Backend**   | Node.js, Express.js                           |
| **Database**  | MongoDB                                       |
| **Chess AI**  | Stockfish Engine                              |
| **Code Judge**| **Judge0** (Planned Integration)              |
| **DevOps**    | Docker, Kubernetes                            |

## 🎯 Performance Metrics

### Chess Engine
- Response time: <100ms per move
- Evaluation depth: Up to 22 ply
- Multi-threading support
- Memory usage optimization

### Code Execution
- Timeout: 2s per test case
- Memory limit: 256MB
- Concurrent execution support
- Sandbox environment

## 🔐 Security Features

- JWT-based authentication
- Rate limiting for API endpoints
- Input sanitization
- Secure code execution
- MongoDB injection prevention
- CORS policy implementation

## 📊 Analytics Dashboard (Upcoming)

- Personal progress tracking
- ELO rating history
- Coding success rate
- Problem-solving patterns
- Time management analysis
- Skill progression maps

## 🗺️ Future Roadmap

CodeMate is just getting started. Here are some of the exciting features planned for the future:

- [ ] **Full Judge0 Integration**: Implement the backend logic to send user code to Judge0 and process the results.
- [ ] **Code Submission Queue**: A robust queue system to handle concurrent code submissions efficiently.
- [ ] **Leaderboards**: Separate leaderboards for chess rating and code challenge rankings.
- [ ] **Challenge System**: A dedicated section with a library of coding challenges of varying difficulty.
- [ ] **Daily Quests**: "Win a game without hints" or "Solve 3 coding challenges" for daily rewards.
- [ ] **Full-fledged Profile**: Expanded user profiles with game history, performance graphs, and achievements.

## 🙌 How to Contribute

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  **Fork the Project**
2.  **Create your Feature Branch** 
3.  **Commit your Changes** 
4.  **Push to the Branch**
5.  **Open a Pull Request**

Don't forget to give the project a star! Thanks again!

---
