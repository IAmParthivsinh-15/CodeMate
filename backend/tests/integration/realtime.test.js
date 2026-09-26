import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as connect } from "socket.io-client";
import { startTestServer, registerUser, eventually } from "../helpers.js";
import GameSession from "../../src/modules/games/gameSession.model.js";

let t;
const sockets = [];
beforeAll(async () => { t = await startTestServer("cm_realtime", { realtime: true, workers: false }); });
afterAll(async () => {
  sockets.forEach((s) => s.close());
  await t.stop();
});

const open = (token) =>
  new Promise((resolve, reject) => {
    const s = connect(t.url, { auth: { token }, transports: ["websocket"], reconnection: false, forceNew: true });
    sockets.push(s);
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
  });
const emit = (s, event, payload) => new Promise((resolve) => s.emit(event, payload, resolve));
const next = (s, event) => new Promise((resolve) => s.once(event, resolve));

async function pair() {
  const a = await registerUser(t.api);
  const b = await registerUser(t.api);
  const sa = await open(a.token);
  const sb = await open(b.token);
  const created = await emit(sa, "room:create", { timeControl: "5+0", color: "white" });
  expect(created.ok).toBe(true);
  const started = next(sa, "game:start");
  const joined = await emit(sb, "room:join", { roomCode: created.game.roomCode });
  expect(joined.ok).toBe(true);
  await started;
  return { a, b, sa, sb, gameId: created.game._id };
}

describe("P2P multiplayer over Socket.IO (spec §10, §37)", () => {
  it("rejects unauthenticated sockets", async () => {
    await expect(open("not-a-token")).rejects.toThrow();
  });

  it("creates a room, joins, and relays server-validated moves", async () => {
    const { sa, sb, gameId } = await pair();
    const seen = next(sb, "game:state");
    const r = await emit(sa, "game:move", { gameId, move: { from: "e2", to: "e4" }, clientMoveId: "m1", expectedPly: 0 });
    expect(r.ok).toBe(true);
    expect((await seen).fen).toContain("4P3");

    const notYours = await emit(sa, "game:move", { gameId, move: { san: "d4" }, clientMoveId: "m2" });
    expect(notYours.error.code).toBe("NOT_YOUR_TURN");
    const illegal = await emit(sb, "game:move", { gameId, move: { san: "e4" }, clientMoveId: "m3" });
    expect(illegal.error.code).toBe("ILLEGAL_MOVE");
  });

  it("ignores duplicate moves (idempotent clientMoveId)", async () => {
    const { sa, gameId } = await pair();
    const first = await emit(sa, "game:move", { gameId, move: { san: "e4" }, clientMoveId: "dup" });
    const second = await emit(sa, "game:move", { gameId, move: { san: "e4" }, clientMoveId: "dup" });
    expect(first.ok && second.ok).toBe(true);
    expect(second.duplicate).toBe(true);
    expect((await GameSession.findById(gameId)).ply).toBe(1);
  });

  it("handles draw offers and resignation", async () => {
    const { sa, sb, gameId } = await pair();
    const offered = next(sb, "draw:offer");
    await emit(sa, "draw:offer", { gameId });
    expect((await offered).by).toBe("w");
    const finished = next(sa, "game:finish");
    await emit(sb, "draw:accept", { gameId });
    expect(await finished).toMatchObject({ result: "1/2-1/2", reason: "agreement" });

    const g2 = await pair();
    const fin = next(g2.sb, "game:finish");
    await emit(g2.sa, "game:resign", { gameId: g2.gameId });
    expect(await fin).toMatchObject({ result: "0-1", reason: "resignation" });
  });

  it("tells the opponent about disconnects and restores state on reconnect", async () => {
    const { a, sa, sb, gameId } = await pair();
    await emit(sa, "game:move", { gameId, move: { san: "e4" }, clientMoveId: "r1" });
    const dropped = next(sb, "player:disconnected");
    sa.close();
    expect((await dropped).userId).toBe(String(a.user._id));
    const back = next(sb, "player:reconnected");
    const sa2 = await open(a.token);
    await back;
    const state = await emit(sa2, "game:state", { gameId });
    expect(state.state).toMatchObject({ ply: 1, turn: "b", status: "in_progress" });
    expect(state.state.clocks.whiteMs).toBeGreaterThan(0);
  });

  it("matchmaking pairs two players in the same queue", async () => {
    const a = await registerUser(t.api);
    const b = await registerUser(t.api);
    const sa = await open(a.token);
    const sb = await open(b.token);
    const ma = next(sa, "matchmaking:matched");
    const mb = next(sb, "matchmaking:matched");
    expect((await emit(sa, "matchmaking:join", { timeControl: "3+2" })).queued).toBe(true);
    await emit(sb, "matchmaking:join", { timeControl: "3+2" });
    const [x, y] = await Promise.all([ma, mb]);
    expect(x.gameId).toBe(y.gameId);
    const game = await eventually(() => GameSession.findById(x.gameId));
    expect(game).toMatchObject({ mode: "online", status: "in_progress" });
  });
});
