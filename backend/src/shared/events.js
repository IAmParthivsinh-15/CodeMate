import { randomUUID } from "crypto";

// Kafka topic names (spec §26). One topic per event type keeps consumers simple.
export const TOPICS = Object.freeze({
  GAME_CREATED: "codemate.game.created",
  GAME_MOVE: "codemate.game.move",
  GAME_FINISHED: "codemate.game.finished",
  ANALYSIS_REQUESTED: "codemate.analysis.requested",
  ANALYSIS_COMPLETED: "codemate.analysis.completed",
  CODE_SUBMITTED: "codemate.code.submitted",
  CODE_COMPLETED: "codemate.code.completed",
  AI_CHAT_COMPLETED: "codemate.ai.chat.completed",
  MATCHMAKING_MATCHED: "codemate.matchmaking.matched",
  RATING_UPDATED: "codemate.rating.updated",
});

// Versioned envelope (spec §27). Payloads carry ids, not whole documents.
export const createEvent = (eventType, payload, version = 1) => ({
  eventId: randomUUID(),
  eventType,
  version,
  timestamp: new Date().toISOString(),
  payload,
});
