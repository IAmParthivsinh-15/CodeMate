import http from "http";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createRealtimeServer } from "../src/sockets/index.js";
import { startWorkers } from "../src/workers/index.js";
import { getBus, closeBus } from "../src/infrastructure/kafka/index.js";
import { closeKv } from "../src/infrastructure/redis/index.js";
import { ingestCorpus } from "../src/modules/ai/rag/ingest.js";
import { shutdownEngines } from "../src/infrastructure/stockfish/chessEngine.js";

// Boots the whole system in-process: HTTP API, Socket.IO and all workers,
// against a fresh database named after the test file.
export async function startTestServer(dbName, { realtime = false, workers = true, knowledge = false } = {}) {
  await mongoose.connect(process.env.MONGO_URL, { dbName });
  await mongoose.connection.db.dropDatabase();
  if (workers) await startWorkers();
  if (knowledge) await ingestCorpus();
  const app = createApp();
  const server = http.createServer(app);
  const io = realtime ? createRealtimeServer(server) : null;
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    app,
    url,
    io,
    api: () => request(app),
    drain: () => getBus().drain(),
    async stop() {
      await io?.shutdown?.();
      await new Promise((resolve) => server.close(resolve));
      await getBus().drain?.();
      await closeBus();
      await closeKv();
      shutdownEngines();
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    },
  };
}

let seq = 0;
export async function registerUser(api, name = `user${Date.now()}${seq++}`) {
  const res = await api()
    .post("/api/auth/register")
    .send({ username: name, email: `${name}@example.com`, password: "password123", confirmPassword: "password123" });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, refreshToken: res.body.refreshToken, user: res.body.user, auth: { Authorization: `Bearer ${res.body.token}` } };
}

// Poll until fn() returns truthy (event-driven work finishes asynchronously).
export async function eventually(fn, { timeoutMs = 60_000, intervalMs = 200 } = {}) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error("eventually: timed out");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
