import express from "express";
import { z } from "zod";
import { protectRoutes } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { limiters } from "../../middleware/rateLimit.js";
import { loadGameFor } from "../games/game.service.js";
import { objectId } from "../games/game.schema.js";
import { chessChat, gameChat, explainMove, getThread, clearThread } from "./ai.service.js";
import { buildCoachReport, coachNarrative } from "./coach.service.js";
import { retrieveKnowledge } from "./rag/retrieve.js";
import { llm } from "../../infrastructure/llm/index.js";
import { ok } from "../../shared/http.js";

const question = z.string().trim().min(2, "Ask a question").max(1000);

// ---- Game Analysis RAG, mounted at /api/games (spec §42) ----
export const gameAiRouter = express.Router();
gameAiRouter.use(protectRoutes);

gameAiRouter.post(
  "/:id/chat",
  limiters.ai,
  validate({ params: z.object({ id: objectId }), body: z.object({ message: question, selectedPly: z.number().int().min(1).optional() }) }),
  async (req, res) => {
    const game = await loadGameFor(req.params.id, req.user._id);
    ok(res, await gameChat(req.user, game, req.body.message, { selectedPly: req.body.selectedPly }));
  }
);

gameAiRouter.get("/:id/chat", validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const game = await loadGameFor(req.params.id, req.user._id);
  ok(res, { messages: await getThread(req.user._id, "game", game._id) });
});

gameAiRouter.delete("/:id/chat", validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const game = await loadGameFor(req.params.id, req.user._id);
  await clearThread(req.user._id, "game", game._id);
  ok(res, { message: "Conversation cleared" });
});

gameAiRouter.post(
  "/:id/moves/:ply/explain",
  limiters.ai,
  validate({ params: z.object({ id: objectId, ply: z.coerce.number().int().min(1) }) }),
  async (req, res) => {
    const game = await loadGameFor(req.params.id, req.user._id);
    ok(res, await explainMove(req.user, game, req.params.ply));
  }
);

// ---- General Chess Knowledge RAG, mounted at /api/chess ----
export const chessAiRouter = express.Router();
chessAiRouter.use(protectRoutes);

chessAiRouter.post("/chat", limiters.ai, validate({ body: z.object({ message: question }) }), async (req, res) => {
  ok(res, await chessChat(req.user, req.body.message));
});
chessAiRouter.get("/chat", async (req, res) => ok(res, { messages: await getThread(req.user._id, "chess") }));
chessAiRouter.delete("/chat", async (req, res) => {
  await clearThread(req.user._id, "chess");
  ok(res, { message: "Conversation cleared" });
});

// Retrieval only (no LLM): used by the knowledge browser and the eval script.
chessAiRouter.get("/knowledge/search", validate({ query: z.object({ q: question, limit: z.coerce.number().int().min(1).max(10).optional() }) }), async (req, res) => {
  const { chunks, classification, appliedTopic } = await retrieveKnowledge(req.validatedQuery.q, { limit: req.validatedQuery.limit || 5 });
  ok(res, { results: chunks, classification, appliedTopic });
});

// ---- AI Coach, mounted at /api/coach (spec §31) ----
export const coachRouter = express.Router();
coachRouter.use(protectRoutes);

coachRouter.get("/report", async (req, res) => ok(res, { report: await buildCoachReport(req.user._id) }));

coachRouter.post("/summary", limiters.ai, async (req, res) => {
  const report = await buildCoachReport(req.user._id);
  ok(res, { report, narrative: await coachNarrative(req.user, report) });
});

coachRouter.post("/chat", limiters.ai, validate({ body: z.object({ message: question }) }), async (req, res) => {
  const report = await buildCoachReport(req.user._id);
  ok(res, await coachNarrative(req.user, report, req.body.message));
});
coachRouter.get("/chat", async (req, res) => ok(res, { messages: await getThread(req.user._id, "coach") }));

// Which provider is active (for the UI's "AI offline, showing engine facts" banner).
export const aiStatusHandler = (req, res) => ok(res, { provider: llm.providerName, enabled: llm.enabled });
