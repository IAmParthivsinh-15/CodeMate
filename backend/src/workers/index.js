import { env } from "../config/env.js";
import { subscribe } from "../infrastructure/kafka/index.js";
import { kv } from "../infrastructure/redis/index.js";
import { TOPICS } from "../shared/events.js";
import { childLogger } from "../infrastructure/logger/index.js";
import { metrics } from "../infrastructure/metrics/index.js";
import GameSession from "../modules/games/gameSession.model.js";
import { analyzeGame } from "../modules/analysis/analysis.service.js";
import { generatePuzzlesForGame } from "../modules/learning/puzzle.service.js";
import { generateAnalysisReport } from "../modules/ai/ai.service.js";
import { processSubmission } from "../modules/coding/coding.service.js";
import { applyAnalysisToStats, applyChatToStats, invalidateDashboard } from "../modules/analytics/analytics.service.js";
import { notifyUser } from "../sockets/notify.js";

const log = childLogger("workers");
const MIN_PLIES_FOR_AUTO_ANALYSIS = 6;

// Every handler is idempotent: Kafka delivers at least once.
const instrument = (topic, group, fn) => async (event) => {
  try {
    await fn(event);
    metrics.eventsProcessed.inc({ topic, group, outcome: "ok" });
  } catch (err) {
    metrics.eventsProcessed.inc({ topic, group, outcome: "error" });
    throw err;
  }
};

async function runAnalysis(gameId) {
  // One analysis per game at a time, across all worker instances.
  if (!(await kv().set(`analysis:lock:${gameId}`, "1", { ttlSec: 600, nx: true }))) return;
  try {
    await analyzeGame(gameId);
    const puzzles = await generatePuzzlesForGame(gameId);
    const game = await GameSession.findById(gameId).select("player whitePlayer blackPlayer");
    for (const u of new Set([game.player, game.whitePlayer, game.blackPlayer].filter(Boolean).map(String))) {
      notifyUser(u, "analysis:update", { gameId: String(gameId), status: "completed", puzzles });
    }
  } finally {
    await kv().del(`analysis:lock:${gameId}`);
  }
}

// Worker name → subscriptions. Group ids are the Kafka consumer groups.
export const WORKERS = {
  analysis: [
    [TOPICS.GAME_FINISHED, "analysis-worker", async ({ payload }) => {
      if (!env.AUTO_ANALYZE || payload.plies < MIN_PLIES_FOR_AUTO_ANALYSIS) return;
      await runAnalysis(payload.gameId);
    }],
    [TOPICS.ANALYSIS_REQUESTED, "analysis-worker", async ({ payload }) => runAnalysis(payload.gameId)],
  ],
  ai: [
    [TOPICS.ANALYSIS_COMPLETED, "ai-worker", async ({ payload }) => {
      await generateAnalysisReport(payload.gameId);
      for (const u of payload.userIds || []) notifyUser(u, "analysis:update", { gameId: payload.gameId, aiStatus: "completed" });
    }],
  ],
  coding: [
    [TOPICS.CODE_SUBMITTED, "coding-worker", async ({ payload }) => processSubmission(payload.submissionId)],
  ],
  analytics: [
    [TOPICS.ANALYSIS_COMPLETED, "analytics-worker", async ({ payload }) => applyAnalysisToStats(payload.gameId)],
    [TOPICS.AI_CHAT_COMPLETED, "analytics-worker", async (event) => applyChatToStats(event)],
    [TOPICS.GAME_FINISHED, "analytics-worker", async ({ payload }) => {
      for (const u of [payload.playerId, payload.whitePlayerId, payload.blackPlayerId].filter(Boolean)) await invalidateDashboard(u);
    }],
    [TOPICS.CODE_COMPLETED, "analytics-worker", async ({ payload }) => invalidateDashboard(payload.userId)],
    [TOPICS.RATING_UPDATED, "analytics-worker", async () => kv().del("leaderboard:all", "leaderboard:month")],
  ],
};

export async function startWorkers(names = env.WORKERS.length ? env.WORKERS : Object.keys(WORKERS)) {
  for (const name of names) {
    const subs = WORKERS[name];
    if (!subs) throw new Error(`Unknown worker "${name}". Known: ${Object.keys(WORKERS).join(", ")}`);
    for (const [topic, group, fn] of subs) await subscribe(topic, group, instrument(topic, group, fn));
    log.info({ worker: name }, "Worker subscribed");
  }
  return names;
}
