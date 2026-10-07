import { describe, it, expect } from "vitest";
import { routeQuestion, wantsHistory } from "../../src/modules/ai/intentRouter.js";
import { checkGrounding, formatEval, chatAnswerSchema } from "../../src/modules/ai/grounding.js";
import { selectRelevantMoves } from "../../src/modules/ai/gameContext.js";
import { parseFrontmatter, chunkDocument, loadCorpus } from "../../src/modules/ai/rag/corpus.js";
import { embedLocal, tokenize } from "../../src/infrastructure/embeddings/localEmbedder.js";
import { classifyChessQuery } from "../../src/modules/ai/rag/retrieve.js";
import { extractJson, modelFor } from "../../src/infrastructure/llm/index.js";
import { THEME_KNOWLEDGE } from "../../src/config/analysis.js";
import { createEvent } from "../../src/shared/events.js";

describe("intent router (spec §22)", () => {
  it("routes general questions to the chess RAG", () => {
    expect(routeQuestion("What is a pin?", { hasGame: true })).toBe("chess");
    expect(routeQuestion("Explain the Lucena position", { hasGame: true })).toBe("chess");
    expect(routeQuestion("what is the e4 opening", { hasGame: true })).toBe("chess");
  });
  it("routes game questions to the game RAG", () => {
    expect(routeQuestion("Why was move 23 a mistake?", { hasGame: true })).toBe("game");
    expect(routeQuestion("Where did I lose the advantage?", { hasGame: true })).toBe("game");
    expect(routeQuestion("Why was Nxe5 bad?", { hasGame: true })).toBe("game");
  });
  it("routes mixed questions to both", () => {
    expect(routeQuestion("Did I miss a fork in this game?", { hasGame: true })).toBe("mixed");
    expect(routeQuestion("Why did I lose my rook? Explain the tactic", { hasGame: true })).toBe("mixed");
  });
  it("always uses the chess RAG without a game", () => {
    expect(routeQuestion("Why did I lose?", { hasGame: false })).toBe("chess");
  });
  it("detects history questions", () => {
    expect(wantsHistory("Did I repeat the same mistake?")).toBe(true);
    expect(wantsHistory("What should I have played?")).toBe(false);
  });
});

describe("grounding (spec §25)", () => {
  it("formats evaluations", () => {
    expect(formatEval(135)).toBe("+1.35");
    expect(formatEval(-40)).toBe("-0.40");
    expect(formatEval(9970, 3)).toBe("M3");
    expect(formatEval(-9990, -1)).toBe("-M1");
  });
  it("flags evaluations that are not in the facts", () => {
    expect(checkGrounding("Stockfish evaluated it at +0.70 then -1.80.", ["+0.70", "-1.80"]).grounded).toBe(true);
    const bad = checkGrounding("The position was +2.50 after your move.", ["+0.70", "-1.80"]);
    expect(bad.grounded).toBe(false);
    expect(bad.unknownNumbers).toEqual(["+2.50"]);
    expect(checkGrounding("Mate in 3 (M3) was available", ["M3"]).grounded).toBe(true);
  });
  it("validates structured output", () => {
    expect(chatAnswerSchema.parse({ answer: "Hi", keyConcepts: ["Pin"] }).keyConcepts).toEqual(["pin"]);
    expect(() => chatAnswerSchema.parse({ answer: "" })).toThrow();
    expect(extractJson('```json\n{"answer":"x"}\n```')).toEqual({ answer: "x" });
  });
});

describe("game RAG move selection", () => {
  const mk = (ply, color, cls, extra = {}) => ({
    ply, color, moveNumber: Math.ceil(ply / 2), classification: cls, centipawnLoss: { blunder: 400, mistake: 150, inaccuracy: 60 }[cls] || 0,
    evaluationBefore: 0, evaluationAfter: color === "w" ? -300 : 300, playedMove: `m${ply}`, themes: [], phase: "middlegame", ...extra,
  });
  const analysis = { moveAnalysis: [mk(1, "w", "book"), mk(2, "b", "good"), mk(45, "w", "mistake"), mk(46, "b", "blunder", { themes: ["hanging_piece"] }), mk(47, "w", "blunder")] };
  it("picks explicitly mentioned moves", () => {
    const { moves } = selectRelevantMoves("Why was move 23 bad?", analysis, ["w"], null);
    expect(moves.map((m) => m.ply)).toEqual([45, 46]);
  });
  it("picks black's move for 23...", () => {
    expect(selectRelevantMoves("what about 23...", analysis, ["w"], null).moves.map((m) => m.ply)).toEqual([46]);
  });
  it("defaults to the player's biggest mistakes", () => {
    const { moves } = selectRelevantMoves("How did I play?", analysis, ["w"], null);
    expect(moves.map((m) => m.ply)).toEqual([45, 47]);
  });
});

describe("RAG ingestion pieces", () => {
  it("parses frontmatter lists", () => {
    const { meta, body } = parseFrontmatter("---\ntitle: Pin\ntags: [pin, absolute pin]\n---\n# Pin\n\nText");
    expect(meta).toEqual({ title: "Pin", tags: ["pin", "absolute pin"] });
    expect(body.startsWith("# Pin")).toBe(true);
  });
  it("chunks by section with metadata", () => {
    const chunks = chunkDocument({ documentId: "tactics/pin", source: "tactics/pin.md", title: "Pin", topic: "tactics", subcategory: "pin", difficulty: "beginner", tags: [], body: "# Pin\n\n## Definition\nA pin is...\n\n## Example\nBb5 pins..." });
    expect(chunks.map((c) => c.section)).toEqual(["Definition", "Example"]);
    expect(chunks[0]).toMatchObject({ chunkId: "tactics/pin#definition", topic: "tactics", subcategory: "pin" });
    expect(chunks[0].text).toContain("Pin — Definition");
  });
  it("the real corpus loads and every theme document exists", () => {
    const docs = loadCorpus();
    expect(docs.length).toBeGreaterThanOrEqual(40);
    const sources = new Set(docs.map((d) => d.source));
    for (const list of Object.values(THEME_KNOWLEDGE)) for (const s of list) expect(sources.has(s), s).toBe(true);
    for (const d of docs) expect(d.source.startsWith(`${d.topic}/`)).toBe(true);
  });
  it("local embeddings are normalised and synonym-aware", () => {
    const v = embedLocal("knight fork");
    expect(Math.hypot(...v)).toBeCloseTo(1, 5);
    expect(tokenize("my horse attacked two pieces at once")).toContain("knight");
    expect(tokenize("my horse attacked two pieces at once")).toContain("fork");
  });
  it("classifies query topics only when unambiguous", () => {
    expect(classifyChessQuery("Explain the Lucena position").topic).toBe("endgames");
    expect(classifyChessQuery("pin in the endgame").topic).toBeNull();
  });
});

describe("infrastructure contracts", () => {
  it("routes tasks to model tiers", () => {
    expect(modelFor("chess_chat", "groq")).toBe("llama-3.1-8b-instant");
    expect(modelFor("coach", "gemini")).toBe("gemini-2.5-pro");
  });
  it("builds versioned event envelopes (spec §27)", () => {
    const e = createEvent("game.finished", { gameId: "g1" });
    expect(e).toMatchObject({ eventType: "game.finished", version: 1, payload: { gameId: "g1" } });
    expect(e.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
