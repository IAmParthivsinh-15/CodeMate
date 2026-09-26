import client from "prom-client";
import { env } from "../../config/env.js";

// Prometheus metrics (spec §43). Exposed at GET /metrics by every process role.
export const registry = new client.Registry();
registry.setDefaultLabels({ role: env.SERVICE_ROLE });
if (env.METRICS_ENABLED) client.collectDefaultMetrics({ register: registry });

const seconds = [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];
const h = (name, help, labelNames = [], buckets = seconds) =>
  new client.Histogram({ name, help, labelNames, buckets, registers: [registry] });
const c = (name, help, labelNames = []) => new client.Counter({ name, help, labelNames, registers: [registry] });
const g = (name, help, labelNames = []) => new client.Gauge({ name, help, labelNames, registers: [registry] });

export const metrics = {
  httpDuration: h("http_request_duration_seconds", "HTTP request latency", ["method", "route", "status"]),
  httpErrors: c("http_errors_total", "HTTP responses with status >= 500", ["method", "route"]),
  wsConnections: g("websocket_connections", "Open Socket.IO connections"),
  activeGames: g("active_online_games", "Online games currently in progress on this instance"),
  gamesCreated: c("games_created_total", "Games created", ["mode"]),
  gamesFinished: c("games_finished_total", "Games finished", ["mode", "reason"]),
  movesTotal: c("moves_total", "Moves applied", ["mode"]),
  stockfishAnalysis: h("stockfish_analysis_duration_seconds", "Full-game Stockfish analysis time", [], [1, 2, 5, 10, 20, 40, 80, 160]),
  ragRetrieval: h("rag_retrieval_duration_seconds", "RAG retrieval latency", ["rag"]),
  llmDuration: h("llm_request_duration_seconds", "LLM call latency", ["provider", "task"]),
  llmErrors: c("llm_errors_total", "LLM call failures", ["provider", "task"]),
  llmTokens: c("llm_tokens_total", "LLM tokens used", ["provider", "type"]),
  judge0Duration: h("judge0_request_duration_seconds", "Judge0 per-test execution latency"),
  eventsProcessed: c("events_processed_total", "Events handled by consumers", ["topic", "group", "outcome"]),
  kafkaLag: g("kafka_consumer_lag", "Kafka consumer lag (messages)", ["group", "topic"]),
  redisLatency: h("redis_ping_duration_seconds", "Redis PING latency", [], [0.0005, 0.001, 0.005, 0.01, 0.05, 0.1]),
  matchmakingQueue: g("matchmaking_queue_size", "Players waiting in matchmaking", ["queue"]),
};

export const timer = (histogram, labels = {}) => {
  const end = histogram.startTimer(labels);
  return (extra = {}) => end(extra);
};
