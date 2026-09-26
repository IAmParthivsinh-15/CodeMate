import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, registerUser, eventually } from "../helpers.js";
import { __setProvider } from "../../src/infrastructure/llm/index.js";

let t;
let auth;
let gameId;
beforeAll(async () => {
  t = await startTestServer("cm_pipeline", { workers: true, knowledge: true });
  ({ auth } = await registerUser(t.api, "pipeline"));
});
afterAll(async () => {
  __setProvider(undefined);
  await t.stop();
});

const play = async (sans) => {
  const id = (await t.api().post("/api/games").set(auth).send({ mode: "local" })).body.game._id;
  for (const san of sans) {
    const r = await t.api().post(`/api/games/${id}/moves`).set(auth).send({ move: { san } });
    if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  }
  return id;
};
const SCHOLARS_MATE = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"];

describe("game.finished → analysis → puzzles → AI report → analytics (spec §28)", () => {
  it("analyses a finished game in the background", async () => {
    gameId = await play(SCHOLARS_MATE);
    const analysis = await eventually(async () => {
      const r = await t.api().get(`/api/games/${gameId}/analysis`).set(auth);
      return r.body.status === "completed" && r.body.aiStatus === "completed" && r.body;
    });
    const nf6 = analysis.analysis.moveAnalysis.find((m) => m.playedMove === "Nf6");
    expect(nf6).toMatchObject({ classification: "blunder", color: "b", moveNumber: 3 });
    expect(nf6.themes).toContain("allowed_mate");
    expect(nf6.bestMove).toBeTruthy();
    expect(nf6.principalVariation.length).toBeGreaterThan(0);
    expect(analysis.analysis.aiReport.summary).toBeTruthy();
    expect(analysis.analysis.aiReport.provider).toBe("none"); // deterministic fallback
  });

  it("creates a puzzle from the blunder and grades answers", async () => {
    const list = await eventually(async () => {
      const r = await t.api().get("/api/puzzles").set(auth);
      return r.body.items?.length && r.body;
    });
    const p = list.items[0];
    expect(p.expectedMove).toBeUndefined(); // answer hidden until solved
    const wrong = await t.api().post(`/api/puzzles/${p._id}/attempt`).set(auth).send({ move: { san: "a6" } });
    expect(wrong.body.correct).toBe(false);
    const reveal = await t.api().post(`/api/puzzles/${p._id}/reveal`).set(auth);
    const right = await t.api().post(`/api/puzzles/${p._id}/attempt`).set(auth).send({ move: { uci: reveal.body.puzzle.expectedMove } });
    expect(right.body.correct).toBe(true);
    expect(right.body.puzzle.solved).toBe(true);
  });

  it("updates dashboard aggregates", async () => {
    const d = await eventually(async () => {
      const r = await t.api().get("/api/dashboard").set(auth);
      return r.body.chess?.gamesAnalyzed >= 1 && r.body;
    });
    expect(d.chess.mistakeDistribution.blunder).toBeGreaterThanOrEqual(1);
    expect(d.learning.puzzles).toBeGreaterThanOrEqual(1);
    expect(d.recentGames[0]._id).toBe(gameId);
  });
});

describe("Game Analysis RAG and explain-move", () => {
  it("answers about a specific move with Stockfish facts and sources", async () => {
    const r = await t.api().post(`/api/games/${gameId}/chat`).set(auth).send({ message: "Why was move 3 a mistake?" });
    expect(r.status).toBe(200);
    expect(r.body.route).toBe("game");
    expect(r.body.facts.some((f) => f.played === "Nf6")).toBe(true);
    expect(r.body.answer).toContain("Stockfish");
    expect(r.body.degraded).toBe(true);
    const history = await t.api().get(`/api/games/${gameId}/chat`).set(auth);
    expect(history.body.messages).toHaveLength(2);
  });

  it("routes pure concept questions to the chess RAG", async () => {
    const r = await t.api().post(`/api/games/${gameId}/chat`).set(auth).send({ message: "What is a pin?" });
    expect(r.body.route).toBe("chess");
    expect(r.body.sources.some((s) => s.source === "tactics/pin.md")).toBe(true);
  });

  it("explains a move in the spec §15 structure and offers practice", async () => {
    const r = await t.api().post(`/api/games/${gameId}/moves/6/explain`).set(auth);
    expect(Object.keys(r.body.explanation)).toEqual(expect.arrayContaining(["whatHappened", "whyItMatters", "betterMove", "concept", "lookFor"]));
    expect(r.body.canPractice).toBe(true);
    const practice = await t.api().post(`/api/games/${gameId}/mistakes/6/practice`).set(auth);
    expect(practice.status).toBe(201);
  });

  it("rejects an LLM answer that invents an evaluation (spec §25)", async () => {
    __setProvider({ name: "fake", generate: async () => ({ text: JSON.stringify({ answer: "Stockfish evaluated this at +4.20.", keyConcepts: [] }), usage: { input: 1, output: 1 } }) });
    const r = await t.api().post(`/api/games/${gameId}/chat`).set(auth).send({ message: "Where did I lose the advantage in this game?" });
    expect(r.body.degraded).toBe(true);
    expect(r.body.groundingWarnings).toContain("+4.20");
    expect(r.body.answer).not.toContain("+4.20");
    __setProvider(undefined);
  });

  it("uses a grounded LLM answer when it only cites real facts", async () => {
    const facts = (await t.api().post(`/api/games/${gameId}/chat`).set(auth).send({ message: "Why was Nf6 bad?" })).body.facts;
    const nf6 = facts.find((f) => f.played === "Nf6");
    __setProvider({ name: "fake", generate: async () => ({ text: JSON.stringify({ answer: `Stockfish evaluated the position at ${nf6.evalBefore} before Nf6.`, keyConcepts: ["king safety"] }), usage: { input: 1, output: 1 } }) });
    const r = await t.api().post(`/api/games/${gameId}/chat`).set(auth).send({ message: "Why was Nf6 bad?" });
    expect(r.body).toMatchObject({ degraded: false, provider: "fake" });
    __setProvider(undefined);
  });
});

describe("Chess Knowledge RAG", () => {
  it("retrieves from the corpus with sources", async () => {
    const r = await t.api().post("/api/chess/chat").set(auth).send({ message: "How do I win a rook endgame by building a bridge?" });
    expect(r.body.sources[0].source).toBe("endgames/rook.md");
    expect(r.body.route).toBe("chess");
  });
  it("search endpoint applies topic filters", async () => {
    const r = await t.api().get("/api/chess/knowledge/search").query({ q: "Explain the Lucena position" }).set(auth);
    expect(r.body.appliedTopic).toBe("endgames");
    expect(r.body.results.every((c) => c.topic === "endgames")).toBe(true);
  });
});

describe("AI coach (spec §31)", () => {
  it("requires enough evidence, then reports strengths, weaknesses and a plan", async () => {
    const early = await t.api().get("/api/coach/report").set(auth);
    expect(early.body.report.enoughData).toBe(false);
    await play(SCHOLARS_MATE);
    const open = await play(["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5", "Nxd5", "Nxf7"]);
    await t.api().post(`/api/games/${open}/resign`).set(auth); // not mate on the board: end it
    const report = await eventually(async () => {
      const r = await t.api().get("/api/coach/report").set(auth);
      return r.body.report.enoughData && r.body.report;
    }, { timeoutMs: 120_000 });
    expect(report.gamesAnalyzed).toBeGreaterThanOrEqual(3);
    expect(report.categories.map((c) => c.key)).toEqual(["opening", "tactics", "strategy", "king_safety", "calculation", "endgame", "time_management"]);
    expect(report.recurringMistakes.length + report.weaknesses.length).toBeGreaterThan(0);
    const summary = await t.api().post("/api/coach/summary").set(auth);
    expect(summary.body.narrative.answer).toContain("analysed games");
  }, 180_000);
});
