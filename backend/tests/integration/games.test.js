import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, registerUser } from "../helpers.js";
import User from "../../src/modules/users/user.model.js";
import RatingHistory from "../../src/modules/ratings/ratingHistory.model.js";

let t;
beforeAll(async () => { t = await startTestServer("cm_games", { workers: false }); });
afterAll(async () => { await t.stop(); });

describe("AI games (server authoritative)", () => {
  it("plays a move and gets the engine's reply", async () => {
    const { auth } = await registerUser(t.api);
    const created = await t.api().post("/api/games").set(auth).send({ mode: "ai", color: "white", difficulty: "beginner" });
    expect(created.status).toBe(201);
    const id = created.body.game._id;
    expect(created.body.game).toMatchObject({ mode: "ai", yourColor: "w", turn: "w", ply: 0 });

    const res = await t.api().post(`/api/games/${id}/moves`).set(auth).send({ move: { from: "e2", to: "e4" }, expectedPly: 0 });
    expect(res.status).toBe(200);
    expect(res.body.move.san).toBe("e4");
    expect(res.body.reply).toBeTruthy(); // engine answered
    expect(res.body.game.ply).toBe(2);
    expect(res.body.game.turn).toBe("w");
  });

  it("rejects illegal moves, stale positions and moves out of turn", async () => {
    const { auth } = await registerUser(t.api);
    const id = (await t.api().post("/api/games").set(auth).send({ mode: "ai", difficulty: "beginner" })).body.game._id;
    const illegal = await t.api().post(`/api/games/${id}/moves`).set(auth).send({ move: { san: "Ke3" } });
    expect(illegal.status).toBe(400);
    expect(illegal.body.error.code).toBe("ILLEGAL_MOVE");
    const stale = await t.api().post(`/api/games/${id}/moves`).set(auth).send({ move: { san: "e4" }, expectedPly: 5 });
    expect(stale.body.error.code).toBe("STALE_POSITION");
  });

  it("engine plays first when the user takes black", async () => {
    const { auth } = await registerUser(t.api);
    const g = (await t.api().post("/api/games").set(auth).send({ mode: "ai", color: "black", difficulty: "beginner" })).body.game;
    expect(g.ply).toBe(1);
    expect(g.turn).toBe("b");
    expect(g.yourColor).toBe("b");
  });

  it("hides other users' games (404, not 403)", async () => {
    const a = await registerUser(t.api);
    const b = await registerUser(t.api);
    const id = (await t.api().post("/api/games").set(a.auth).send({ mode: "local" })).body.game._id;
    expect((await t.api().get(`/api/games/${id}`).set(b.auth)).status).toBe(404);
    expect((await t.api().post(`/api/games/${id}/moves`).set(b.auth).send({ move: { san: "e4" } })).status).toBe(404);
    expect((await t.api().post("/api/game/save").set(b.auth).send({ gameId: id, move: "e4" })).status).toBe(404);
  });

  it("resigning computes the result, stats, rating and PGN on the server", async () => {
    const { auth, user } = await registerUser(t.api);
    const id = (await t.api().post("/api/games").set(auth).send({ mode: "ai", difficulty: "beginner" })).body.game._id; // bot Elo 1000 vs 800
    await t.api().post(`/api/games/${id}/moves`).set(auth).send({ move: { san: "e4" } });
    const res = await t.api().post(`/api/games/${id}/resign`).set(auth);
    expect(res.body.game).toMatchObject({ status: "completed", result: "0-1", endReason: "resignation", analysisStatus: "none" }); // 3 plies: below the auto-analysis minimum
    expect(res.body.game.pgn).toContain('[Result "0-1"]');
    expect(res.body.game.ratingChange.white).toBe(-10); // K=40 × (0 − 0.24)
    const u = await User.findById(user._id).lean();
    expect(u.chessStats).toMatchObject({ gamesPlayed: 1, losses: 1 });
    expect(await RatingHistory.countDocuments({ user: user._id })).toBe(1);
    expect((await t.api().post(`/api/games/${id}/resign`).set(auth)).status).toBe(409); // idempotent end
    const pgn = await t.api().get(`/api/games/${id}/pgn`).set(auth);
    expect(pgn.headers["content-type"]).toContain("chess-pgn");
  });

  it("local games detect checkmate from the board", async () => {
    const { auth } = await registerUser(t.api);
    const id = (await t.api().post("/api/games").set(auth).send({ mode: "local" })).body.game._id;
    let last;
    for (const san of ["f3", "e5", "g4", "Qh4#"]) last = await t.api().post(`/api/games/${id}/moves`).set(auth).send({ move: { san } });
    expect(last.body.outcome).toEqual({ result: "0-1", reason: "checkmate" });
    expect(last.body.game.status).toBe("completed");
  });

  it("aborts only before the second move, and paginates history", async () => {
    const { auth } = await registerUser(t.api);
    const id = (await t.api().post("/api/games").set(auth).send({ mode: "local" })).body.game._id;
    expect((await t.api().post(`/api/games/${id}/abort`).set(auth)).body.game.status).toBe("abandoned");
    for (let i = 0; i < 3; i++) await t.api().post("/api/games").set(auth).send({ mode: "local" });
    const page = await t.api().get("/api/games?limit=2&page=1").set(auth);
    expect(page.body.items).toHaveLength(2);
    expect(page.body.pagination).toMatchObject({ total: 4, pages: 2 });
  });

  it("hints cost a credit earned from coding", async () => {
    const { auth, user } = await registerUser(t.api);
    const id = (await t.api().post("/api/games").set(auth).send({ mode: "ai", difficulty: "beginner" })).body.game._id;
    expect((await t.api().post(`/api/games/${id}/hint`).set(auth)).body.error.code).toBe("NO_HINT_CREDITS");
    await User.updateOne({ _id: user._id }, { hintCredits: 1 });
    const hint = await t.api().post(`/api/games/${id}/hint`).set(auth);
    expect(hint.status).toBe(200);
    expect(hint.body.bestMove.san).toBeTruthy();
    expect(hint.body.hintCredits).toBe(0);
  });
});

describe("legacy /api/game endpoints", () => {
  it("still work, but the server decides moves and results", async () => {
    const { auth } = await registerUser(t.api);
    const start = await t.api().post("/api/game/start").set(auth).send({ opponent: "human" });
    expect(start.status).toBe(201);
    const gameId = start.body.gameId;
    const save = await t.api().post("/api/game/save").set(auth).send({ gameId, move: "e4", fen: "totally-fake-fen" });
    expect(save.body.currentFEN).toContain("4P3"); // computed, not the client's FEN
    expect((await t.api().post("/api/game/save").set(auth).send({ gameId, move: "e4" })).status).toBe(400); // illegal now
    const won = await t.api().post("/api/game/end").set(auth).send({ gameId, status: "won" });
    expect(won.body.error.code).toBe("GAME_NOT_OVER"); // can't claim a win
    const lost = await t.api().post("/api/game/end").set(auth).send({ gameId, status: "abandoned" });
    expect(lost.body.status).toBe("abandoned");
  });
});
