import http from "http";
import { env } from "./config/env.js";
import { logger } from "./infrastructure/logger/index.js";
import connectDB, { disconnectDB } from "./infrastructure/mongodb/connection.js";
import { connectKv, closeKv } from "./infrastructure/redis/index.js";
import { connectBus, closeBus, getBus } from "./infrastructure/kafka/index.js";
import { shutdownEngines } from "./infrastructure/stockfish/chessEngine.js";
import { metrics } from "./infrastructure/metrics/index.js";
import { createApp } from "./app.js";
import { createRealtimeServer } from "./sockets/index.js";
import { startWorkers } from "./workers/index.js";
import { ensureKnowledgeIndex } from "./modules/ai/rag/ingest.js";

// One codebase, several deployable roles (docs/architecture/service-boundaries.md):
//   all      – API + realtime + workers in one process (local development)
//   api      – REST API only
//   realtime – Socket.IO gateway (+ the HTTP API, so it can serve health checks)
//   worker   – event consumers only (WORKERS=analysis,ai,coding,analytics)
const role = env.SERVICE_ROLE;
const serves = { http: role !== "worker", realtime: role === "all" || role === "realtime", workers: role === "all" || role === "worker" };

async function main() {
  await connectDB();
  await connectKv();
  await connectBus();

  // The chess RAG index is needed wherever chat is answered (API) or reports are written (AI worker).
  if (serves.http || serves.workers) {
    ensureKnowledgeIndex().catch((err) => logger.error({ err }, "Knowledge index initialisation failed"));
  }

  const app = createApp();
  const server = http.createServer(app);
  let io;
  if (serves.realtime) io = createRealtimeServer(server);
  if (serves.workers) await startWorkers();

  // Workers still expose /health, /ready and /metrics for probes and Prometheus.
  server.listen(env.PORT, () => logger.info({ port: env.PORT, role, serves }, `CodeMate ${role} listening on http://localhost:${env.PORT}`));

  if (getBus().kind === "kafka") {
    const t = setInterval(async () => {
      try {
        for (const l of await getBus().lag()) metrics.kafkaLag.set({ group: l.groupId, topic: l.topic }, l.lag);
      } catch (err) {
        logger.warn({ err: err.message }, "Could not read Kafka lag");
      }
    }, 30_000);
    t.unref();
  }

  const shutdown = async (signal) => {
    logger.info({ signal }, "Shutting down");
    server.close();
    await io?.shutdown?.();
    await closeBus().catch(() => {});
    shutdownEngines();
    await closeKv().catch(() => {});
    await disconnectDB().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Startup failed");
  process.exit(1);
});
