# CodeMate backend image. One image, several roles (SERVICE_ROLE=api|realtime|worker|all).
# Build from the repo root:  docker build -f infrastructure/docker/backend/Dockerfile -t codemate-backend .
FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app/backend

# Dependencies first for layer caching. bcrypt ships prebuilt binaries for linux-x64.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/src ./src
COPY backend/scripts ./scripts
# Linux Stockfish only (the .exe is excluded by .dockerignore).
COPY backend/engine/stockfish ./engine/stockfish
# Chess knowledge corpus and prompt templates (read at runtime from ../ai).
COPY ai /app/ai

RUN chmod 755 ./engine/stockfish && chown -R node:node /app
USER node

EXPOSE 5050
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5050)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
