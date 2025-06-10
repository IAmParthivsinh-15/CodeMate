# CodeMate Backend

A powerful chess gaming backend built with Node.js, Express, MongoDB, and Stockfish engine.

## 🚀 Technology Stack

- **Runtime**: Node.js v20.11.1
- **Framework**: Express.js
- **Database**: MongoDB
- **Chess Engine**: Stockfish
- **Authentication**: JWT (Access & Refresh Tokens)
- **Container**: Docker
- **Orchestration**: Kubernetes

## 📁 Project Structure

```
backend/
├── config/
│   └── db.js           # MongoDB connection configuration
├── controller/
│   ├── auth.js         # Authentication controllers
│   ├── game.js         # Game logic controllers
│   └── testEngine.js   # Chess engine test controllers
├── engine/
│   ├── stockfish       # Linux Stockfish executable
│   └── stockfish.exe   # Windows Stockfish executable
├── k8s/
│   ├── configmap.yaml  # Kubernetes ConfigMap
│   ├── deployment.yaml # Kubernetes Deployment
│   ├── secret.yaml     # Kubernetes Secrets
│   └── service.yaml    # Kubernetes Service
├── middlewares/
│   └── auth.js         # Authentication middleware
├── model/
│   └── user.js         # User model schema
├── routes/
│   ├── auth.js         # Authentication routes
│   └── game.js         # Game routes
├── services/
│   └── chessEngine.js  # Chess engine service
├── utils/
│   └── genToken.js     # Token generation utilities
├── Dockerfile          # Docker configuration
└── server.js           # Main application entry
```

## 🔑 Authentication

### JWT Token System
- Access Token: 15 minutes expiry
- Refresh Token: 7 days expiry
- Secure HTTP-only cookies

### API Endpoints

#### Authentication Routes (`/api/auth`)
```
POST /register - Register new user
POST /login    - User login
POST /logout   - User logout
POST /refresh  - Refresh access token
GET  /me       - Get user profile
```

#### Game Routes (`/api/game`)
```
POST /move     - Make a chess move
GET  /history  - Get game history
POST /analyze  - Analyze position
```

## 💾 Database Schema

### User Model
```javascript
{
  username: String,
  email: String,
  password: String,
  chessStats: {
    gamesPlayed: Number,
    rating: Number,
    wins: Number,
    losses: Number,
    draws: Number
  },
  codingStats: {
    problemsSolved: Number,
    preferredLanguage: String
  },
  refreshTokens: [{
    token: String,
    expires: Date
  }]
}
```

## 🎮 Chess Engine Integration

### Difficulty Levels
- Beginner (depth: 5)
- Intermediate (depth: 10)
- Advanced (depth: 15)
- Master (depth: 18)
- Grandmaster (depth: 20)
- Legendary (depth: 22)

### Engine Configuration
```javascript
const config = {
  beginner: { level: 0, depth: 5 },
  intermediate: { level: 5, depth: 10 },
  advanced: { level: 10, depth: 15 },
  master: { level: 15, depth: 18 },
  grandmaster: { level: 20, depth: 20 },
  legendary: { level: 20, depth: 22 }
};
```

## 🐳 Docker Configuration

```dockerfile
FROM node:20-slim
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN chmod +x ./engine/stockfish
EXPOSE 5050
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t codemate-backend .
docker run -p 5050:5050 codemate-backend
```

## ☸️ Kubernetes Configuration

All Kubernetes manifests for deploying the backend are available in the [`k8s/`](./k8s) directory.

### Included Manifests:
- `configmap.yaml` – App-level configuration
- `deployment.yaml` – Backend deployment configuration
- `service.yaml` – Exposes backend using NodePort
- `secrets.yaml` – Stores sensitive environment variables securely


## 🚀 Environment Variables

Required environment variables in `.env`:
```
PORT=5050
MONGO_URL=your_mongodb_url
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

## 🏃‍♂️ Running Locally

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

Server runs at `http://localhost:5050`

## 🔄 API Testing

Using Postman or curl:

### Register User
```bash
curl -X POST http://localhost:5050/api/auth/register \
-H "Content-Type: application/json" \
-d '{
  "username": "test",
  "email": "test@example.com",
  "password": "password123"
}'
```

### Get Chess Move
```bash
curl -X POST http://localhost:5050/api/test \
-H "Content-Type: application/json" \
-d '{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "level": "intermediate"
}'
```

## 🔐 Security

- CORS enabled
- Rate limiting
- HTTP-only cookies
- Helmet security headers
- Password hashing with bcrypt

## 📝 Logging

Console logging for:
- API requests
- Database operations
- Chess engine moves
- Authentication events

