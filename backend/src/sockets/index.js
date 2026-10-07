import { Server } from "socket.io";
import { env } from "../config/env.js";
import { childLogger } from "../infrastructure/logger/index.js";
import { metrics } from "../infrastructure/metrics/index.js";
import { kv, rawRedis } from "../infrastructure/redis/index.js";
import { userFromToken } from "../middleware/auth.js";
import { tokenFromCookieHeader } from "../modules/auth/tokens.js";
import { AppError } from "../shared/errors.js";
import { setIo, userRoom } from "./notify.js";
import GameSession from "../modules/games/gameSession.model.js";
import * as games from "../modules/games/game.service.js";
import * as online from "../modules/games/online.service.js";
import * as mm from "../modules/matchmaking/matchmaking.service.js";
import { gameView } from "../modules/games/game.controller.js";

const log = childLogger("realtime");

export const gameRoom = (gameId) => `game:${gameId}`;
export const DISCONNECT_GRACE_MS = 60_000;
const DISCONNECTS_KEY = "realtime:disconnects";
const disconnectedKey = (gameId, userId) => `game:${gameId}:disconnected:${userId}`;
const presenceKey = (userId) => `user:${userId}:presence`;
const socketsKey = (userId) => `user:${userId}:sockets`;
const PRESENCE_TTL_SEC = 60;
const STALE_ROOM_MS = 30 * 60_000;

// Uniform ack: cb({ ok: true, ...data }) or cb({ ok: false, error: { code, message } }).
const handler = (socket, name, fn) =>
  socket.on(name, async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    try {
      ack({ ok: true, ...((await fn(payload ?? {})) || {}) });
    } catch (err) {
      const e = err instanceof AppError ? err : null;
      if (!e) log.error({ err, event: name }, "Socket handler error");
      ack({ ok: false, error: { code: e?.code || "INTERNAL_ERROR", message: e?.message || "Something went wrong" } });
    }
  });

async function participantGame(gameId, userId) {
  const game = await GameSession.findById(gameId);
  if (!game || !game.isParticipant(userId)) throw new AppError("GAME_NOT_FOUND", "Game not found", 404);
  return game;
}

export function createRealtimeServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : true, credentials: true },
    pingInterval: 20_000,
    pingTimeout: 20_000,
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000 },
  });
  setIo(io);

  // Several realtime instances share rooms through Redis pub/sub.
  if (rawRedis()) {
    import("@socket.io/redis-adapter").then(({ createAdapter }) => {
      const pub = rawRedis().duplicate();
      const sub = rawRedis().duplicate();
      io.adapter(createAdapter(pub, sub));
      log.info("Socket.IO Redis adapter enabled");
    });
  }

  const broadcastState = async (game, extra = {}) => {
    const state = await games.cacheLiveState(game);
    io.to(gameRoom(game._id)).emit("game:state", { ...state, ...extra });
    if (game.isFinished()) {
      io.to(gameRoom(game._id)).emit("game:finish", {
        gameId: String(game._id), result: game.result, reason: game.endReason, ratingChange: game.ratingChange || null, state,
      });
    }
    return state;
  };

  // WebSocket authentication (spec §38): token in handshake auth, or the jwt cookie.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || tokenFromCookieHeader(socket.handshake.headers.cookie);
      socket.data.user = await userFromToken(token);
      next();
    } catch (err) {
      next(Object.assign(new Error(err.message || "Unauthorized"), { data: { code: err.code || "UNAUTHORIZED" } }));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user;
    const uid = String(user._id);
    metrics.wsConnections.inc();
    socket.join(userRoom(uid));
    await kv().incr(socketsKey(uid), 24 * 3600);
    await kv().set(presenceKey(uid), "online", { ttlSec: PRESENCE_TTL_SEC });

    // Reconnect: rejoin active online games and tell opponents we're back.
    const active = await GameSession.find({ mode: "online", status: { $in: ["waiting", "in_progress"] }, $or: [{ whitePlayer: user._id }, { blackPlayer: user._id }] }).select("_id");
    for (const g of active) {
      socket.join(gameRoom(g._id));
      if (await kv().del(disconnectedKey(g._id, uid))) {
        await kv().zrem(DISCONNECTS_KEY, `${g._id}:${uid}`);
        socket.to(gameRoom(g._id)).emit("player:reconnected", { gameId: String(g._id), userId: uid });
      }
    }
    socket.emit("session", { userId: uid, activeGames: active.map((g) => String(g._id)) });

    handler(socket, "presence:heartbeat", async () => {
      await kv().set(presenceKey(uid), "online", { ttlSec: PRESENCE_TTL_SEC });
      return { serverTime: Date.now() };
    });

    handler(socket, "presence:query", async ({ userIds = [] }) => {
      const out = {};
      for (const id of userIds.slice(0, 50)) out[id] = (await kv().get(presenceKey(id))) === "online";
      return { presence: out };
    });

    // ---- rooms ----
    handler(socket, "room:create", async ({ timeControl, rated, color }) => {
      const game = await online.createRoom(user, { timeControl, rated: !!rated, color });
      socket.join(gameRoom(game._id));
      return { game: await gameView(game, user._id) };
    });

    handler(socket, "room:join", async ({ roomCode, gameId }) => {
      const { game, started } = await online.joinRoom(user, { roomCode, gameId });
      socket.join(gameRoom(game._id));
      const view = await gameView(game, user._id);
      if (started) {
        const state = await games.cacheLiveState(game);
        io.to(gameRoom(game._id)).emit("game:start", { gameId: String(game._id), state });
        io.to(userRoom(String(game.player))).emit("room:joined", { gameId: String(game._id), opponent: { _id: uid, username: user.username } });
      }
      return { game: view, started };
    });

    handler(socket, "room:ready", async ({ gameId }) => {
      const game = await participantGame(gameId, user._id);
      socket.join(gameRoom(game._id));
      return { game: await gameView(game, user._id), state: await games.getLiveState(game._id) };
    });

    handler(socket, "room:leave", async ({ gameId }) => {
      const game = await participantGame(gameId, user._id);
      if (game.status === "waiting") await online.abortWaitingRoom(game, user._id);
      socket.leave(gameRoom(game._id));
      return {};
    });

    // ---- game ----
    handler(socket, "game:state", async ({ gameId }) => {
      await participantGame(gameId, user._id);
      return { state: await games.getLiveState(gameId) };
    });

    handler(socket, "game:move", async ({ gameId, move, clientMoveId, expectedPly }) => {
      const game = await participantGame(gameId, user._id);
      if (game.mode !== "online") throw new AppError("WRONG_MODE", "Use the REST API for AI and local games", 400);
      // Duplicate protection (spec §37): the same clientMoveId is applied once.
      if (clientMoveId) {
        const fresh = await kv().set(`move:${gameId}:${clientMoveId}`, "1", { ttlSec: 3600, nx: true });
        if (!fresh) return { duplicate: true, state: await games.getLiveState(gameId) };
      }
      try {
        const { game: updated, move: record } = await games.applyMove(game, {
          userId: user._id, input: move, clientMoveId, expectedPly: typeof expectedPly === "number" ? expectedPly : undefined,
        });
        const state = await broadcastState(updated, { move: record });
        return { state, move: record };
      } catch (err) {
        if (clientMoveId) await kv().del(`move:${gameId}:${clientMoveId}`); // allow a corrected retry
        throw err;
      }
    });

    handler(socket, "game:resign", async ({ gameId }) => {
      const game = await participantGame(gameId, user._id);
      return { state: await broadcastState(await games.resign(game, user._id)) };
    });

    handler(socket, "draw:offer", async ({ gameId }) => {
      const game = await participantGame(gameId, user._id);
      const r = await online.offerDraw(game, user._id);
      if (r.accepted) return { accepted: true, state: await broadcastState(r.game) };
      socket.to(gameRoom(game._id)).emit("draw:offer", { gameId: String(game._id), by: r.by });
      await games.cacheLiveState(r.game);
      return { accepted: false };
    });

    for (const [event, accept] of [["draw:accept", true], ["draw:reject", false]]) {
      handler(socket, event, async ({ gameId }) => {
        const game = await participantGame(gameId, user._id);
        const r = await online.answerDraw(game, user._id, accept);
        if (r.accepted) return { state: await broadcastState(r.game) };
        socket.to(gameRoom(game._id)).emit("draw:reject", { gameId: String(game._id) });
        return { state: await broadcastState(r.game) };
      });
    }

    for (const [event, paused] of [["game:pause", true], ["game:resume", false]]) {
      handler(socket, event, async ({ gameId }) => {
        const game = await participantGame(gameId, user._id);
        const updated = await online.setPaused(game, user._id, paused);
        io.to(gameRoom(game._id)).emit(event, { gameId: String(game._id), by: uid });
        return { state: await broadcastState(updated) };
      });
    }

    // ---- matchmaking ----
    handler(socket, "matchmaking:join", async ({ timeControl, rated }) => mm.joinQueue(user, { timeControl, rated: !!rated }));
    handler(socket, "matchmaking:leave", async () => mm.leaveQueue(user._id));
    handler(socket, "matchmaking:status", async () => mm.queueStatus(user._id));

    socket.on("disconnect", async () => {
      metrics.wsConnections.dec();
      const remaining = await kv().decr(socketsKey(uid));
      if (remaining > 0) return; // other tabs still connected
      await kv().del(presenceKey(uid));
      await mm.leaveQueue(uid);
      const inPlay = await GameSession.find({ mode: "online", status: "in_progress", $or: [{ whitePlayer: user._id }, { blackPlayer: user._id }] }).select("_id");
      for (const g of inPlay) {
        await kv().set(disconnectedKey(g._id, uid), String(Date.now()), { ttlSec: 3600 });
        await kv().zadd(DISCONNECTS_KEY, Date.now() + DISCONNECT_GRACE_MS, `${g._id}:${uid}`);
        io.to(gameRoom(g._id)).emit("player:disconnected", { gameId: String(g._id), userId: uid, graceMs: DISCONNECT_GRACE_MS });
      }
    });
  });

  // ---- sweeper: clocks, abandoned games, stale rooms, matchmaking ----
  let lastStaleSweep = 0;
  const sweep = async () => {
    // Only one instance sweeps per tick.
    if (!(await kv().set("realtime:sweeper:lock", "1", { ttlSec: 2, nx: true }))) return;
    const now = Date.now();
    for (const { member } of await kv().zrangeByScore(games.DEADLINES_KEY, 0, now)) {
      const finished = await online.checkFlag(member);
      if (finished) await broadcastState(finished);
      else {
        // Not flagged (clock moved on or game over): the next move re-adds the deadline.
        const g = await GameSession.findById(member);
        if (!g || g.isFinished()) await kv().zrem(games.DEADLINES_KEY, member);
        else await games.cacheLiveState(g);
      }
    }
    for (const { member } of await kv().zrangeByScore(DISCONNECTS_KEY, 0, now)) {
      await kv().zrem(DISCONNECTS_KEY, member);
      const [gameId, userId] = member.split(":");
      if (!(await kv().get(disconnectedKey(gameId, userId)))) continue; // reconnected in time
      const finished = await online.abandonBy(gameId, userId);
      if (finished) await broadcastState(finished);
    }
    if (now - lastStaleSweep > 60_000) {
      lastStaleSweep = now;
      const stale = await GameSession.find({ mode: "online", status: "waiting", createdAt: { $lt: new Date(now - STALE_ROOM_MS) } }).select("_id");
      for (const g of stale) await games.finishGame(g._id, { result: "*", reason: "aborted" });
    }
    await mm.matchTick(async (game, userIds) => {
      for (const id of userIds) {
        io.in(userRoom(id)).socketsJoin(gameRoom(game._id));
        io.to(userRoom(id)).emit("matchmaking:matched", { gameId: String(game._id) });
      }
      io.to(gameRoom(game._id)).emit("game:start", { gameId: String(game._id), state: await games.getLiveState(game._id) });
    });
  };
  const timer = setInterval(() => sweep().catch((err) => log.error({ err }, "Sweeper failed")), 1000);
  timer.unref();

  io.shutdown = async () => {
    clearInterval(timer);
    await new Promise((resolve) => io.close(() => resolve()));
  };
  return io;
}
