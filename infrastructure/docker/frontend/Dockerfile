# CodeMate frontend: static build served by nginx, which also proxies the API
# and WebSocket traffic so the browser sees one origin (httpOnly cookies work).
# Build from the repo root:  docker build -f infrastructure/docker/frontend/Dockerfile -t codemate-frontend .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY infrastructure/docker/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# Upstreams are set per environment (docker compose / Kubernetes services).
ENV API_UPSTREAM=api:5050 REALTIME_UPSTREAM=realtime:5050
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
