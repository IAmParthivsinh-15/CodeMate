import { describe, it, expect } from "vitest";
import { parseInfoLine, parseBestMove, scoreToCp, toWhitePov, MATE_CP } from "../../src/infrastructure/stockfish/uci.js";
import { expectedScore, ratingDelta, kFactor, applyDelta } from "../../src/modules/ratings/elo.js";
import { classifyOpening, isBookMove } from "../../src/modules/chess/openings.js";
import { classifyMove, winPercent, moveAccuracy, ANALYSIS_THRESHOLDS } from "../../src/config/analysis.js";
import { detectOutcome, normalizeMoveInput } from "../../src/modules/games/game.service.js";
import { Chess } from "chess.js";

describe("UCI parsing", () => {
  it("parses centipawn info lines", () => {
    const info = parseInfoLine("info depth 12 seldepth 18 multipv 1 score cp -34 nodes 1000 nps 1 pv e7e5 g1f3 b8c6");
    expect(info).toEqual({ depth: 12, multipv: 1, score: { type: "cp", value: -34 }, pv: ["e7e5", "g1f3", "b8c6"] });
  });
  it("parses mate scores and ignores bound lines", () => {
    expect(parseInfoLine("info depth 5 score mate 2 pv a1a8").score).toEqual({ type: "mate", value: 2 });
    expect(parseInfoLine("info depth 9 score cp 20 lowerbound pv e2e4")).toBeNull();
    expect(parseInfoLine("info string NNUE enabled")).toBeNull();
  });
  it("parses bestmove, including (none)", () => {
    expect(parseBestMove("bestmove e2e4 ponder e7e5")).toEqual({ bestMove: "e2e4", ponder: "e7e5" });
    expect(parseBestMove("bestmove (none)").bestMove).toBeNull();
  });
  it("converts mate to large cp and flips point of view", () => {
    expect(scoreToCp({ type: "mate", value: 3 })).toBe(MATE_CP - 30);
    expect(scoreToCp({ type: "mate", value: -1 })).toBe(-(MATE_CP - 10));
    expect(toWhitePov({ type: "cp", value: 50 }, "b")).toEqual({ type: "cp", value: -50 });
  });
});

describe("Elo", () => {
  it("is symmetric and deterministic", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
    expect(ratingDelta(1500, 1500, 1, 50)).toBe(10); // K=20
    expect(ratingDelta(1500, 1500, 0, 50)).toBe(-10);
    expect(ratingDelta(800, 800, 1, 0)).toBe(20); // provisional K=40
  });
  it("uses K by experience and rating, with a floor", () => {
    expect(kFactor(1500, 10)).toBe(40);
    expect(kFactor(1500, 100)).toBe(20);
    expect(kFactor(2500, 100)).toBe(10);
    expect(applyDelta(105, -50)).toBe(100);
  });
});

describe("openings", () => {
  it("classifies by longest prefix", () => {
    expect(classifyOpening(["e4", "c5"]).name).toBe("Sicilian Defense");
    expect(classifyOpening(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4"]).name).toBe("Ruy Lopez: Morphy Defense");
    expect(classifyOpening(["a3"])).toBeNull();
  });
  it("detects book moves", () => {
    expect(isBookMove(["e4", "e5", "Nf3"], 2)).toBe(true);
    expect(isBookMove(["e4", "e5", "Ke2"], 2)).toBe(false);
  });
});

describe("move classification thresholds", () => {
  it("classifies by win-probability drop, then book/best/cpl", () => {
    const t = ANALYSIS_THRESHOLDS;
    expect(classifyMove({ isBest: false, isBook: false, cpl: 400, winDrop: t.winDrop.blunder })).toBe("blunder");
    expect(classifyMove({ isBest: false, isBook: false, cpl: 150, winDrop: t.winDrop.mistake })).toBe("mistake");
    expect(classifyMove({ isBest: false, isBook: false, cpl: 60, winDrop: t.winDrop.inaccuracy })).toBe("inaccuracy");
    expect(classifyMove({ isBest: false, isBook: true, cpl: 20, winDrop: 1 })).toBe("book");
    expect(classifyMove({ isBest: true, isBook: false, cpl: 0, winDrop: 0 })).toBe("best");
    expect(classifyMove({ isBest: false, isBook: false, cpl: 5, winDrop: 0.5 })).toBe("excellent");
    expect(classifyMove({ isBest: false, isBook: false, cpl: 300, winDrop: 1 })).toBe("good"); // decided position
  });
  it("win percent and accuracy behave sensibly", () => {
    expect(winPercent(0)).toBeCloseTo(50);
    expect(winPercent(1000)).toBeGreaterThan(95);
    expect(moveAccuracy(60, 60)).toBeCloseTo(100, 0);
    expect(moveAccuracy(80, 20)).toBeLessThan(10);
  });
});

describe("rules", () => {
  it("detects checkmate and draws", () => {
    const fool = new Chess();
    ["f3", "e5", "g4", "Qh4#"].forEach((m) => fool.move(m));
    expect(detectOutcome(fool)).toEqual({ result: "0-1", reason: "checkmate" });
    expect(detectOutcome(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))).toEqual({ result: "1/2-1/2", reason: "stalemate" });
    expect(detectOutcome(new Chess("8/8/8/4k3/8/8/4K3/8 w - - 0 1")).reason).toBe("insufficient_material");
    expect(detectOutcome(new Chess())).toBeNull();
  });
  it("normalises move inputs", () => {
    expect(normalizeMoveInput({ from: "e7", to: "e8" })).toEqual({ from: "e7", to: "e8", promotion: "q" });
    expect(normalizeMoveInput("Nf3")).toBe("Nf3");
    expect(normalizeMoveInput({ uci: "e2e4" })).toBe("e2e4");
    expect(() => normalizeMoveInput({ foo: 1 })).toThrow();
  });
});
