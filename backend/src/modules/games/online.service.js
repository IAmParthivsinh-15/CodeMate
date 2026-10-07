import { randomInt } from "crypto";
import GameSession from "./gameSession.model.js";
import { replay, currentClocks, cacheLiveState, finishGame, agreeDraw } from "./game.service.js";
import { publish } from "../../infrastructure/kafka/index.js";
import { TOPICS } from "../../shared/events.js";
import { badRequest, conflict, forbidden, notFound } from "../../shared/errors.js";
import { metrics } from "../../infrastructure/metrics/index.js";

// Online (P2P) games. All state changes are conditional MongoDB updates, so
// two instances racing on the same game can't both win.

export const TIME_CONTROLS = Object.freeze({
  "1+0": { initialMs: 60_000, incrementMs: 0, label: "Bullet 1+0" },
  "3+2": { initialMs: 180_000, incrementMs: 2_000, label: "Blitz 3+2" },
  "5+0": { initialMs: 300_000, incrementMs: 0, label: "Blitz 5+0" },
  "10+0": { initialMs: 600_000, incrementMs: 0, label: "Rapid 10+0" },
  "15+10": { initialMs: 900_000, incrementMs: 10_000, label: "Rapid 15+10" },
});
export const timeControlOf = (key) => {
  const tc = TIME_CONTROLS[key];
  if (!tc) throw badRequest(`Unknown time control. Use one of: ${Object.keys(TIME_CONTROLS).join(", ")}`, undefined, "INVALID_TIME_CONTROL");
  return { initialMs: tc.initialMs, incrementMs: tc.incrementMs };
};

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const newRoomCode = () => Array.from({ length: 6 }, () => ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join("");

const startClocks = (tc) => ({ whiteMs: tc.initialMs, blackMs: tc.initialMs, lastMoveAt: new Date() });

export async function createRoom(user, { timeControl = "5+0", rated = false, color = "random" }) {
  const tc = timeControlOf(timeControl);
  const side = color === "random" ? (randomInt(2) ? "w" : "b") : color === "black" ? "b" : "w";
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const game = await GameSession.create({
        player: user._id,
        mode: "online",
        opponent: "human",
        playerColor: side,
        whitePlayer: side === "w" ? user._id : null,
        blackPlayer: side === "b" ? user._id : null,
        status: "waiting",
        rated,
        timeControl: tc,
        roomCode: newRoomCode(),
      });
      await publish(TOPICS.GAME_CREATED, "game.created", { gameId: String(game._id), mode: "online", playerId: String(user._id) });
      metrics.gamesCreated.inc({ mode: "online" });
      return game;
    } catch (err) {
      if (err.code !== 11000) throw err; // room code collision: retry
    }
  }
  throw conflict("Could not allocate a room code", "ROOM_CODE_EXHAUSTED");
}

export async function joinRoom(user, { roomCode, gameId }) {
  const filter = roomCode ? { roomCode: String(roomCode).toUpperCase() } : { _id: gameId };
  const game = await GameSession.findOne(filter);
  if (!game || game.mode !== "online") throw notFound("Room");
  if (game.isParticipant(user._id)) return { game, started: false }; // rejoin / reconnect
  if (game.status !== "waiting") throw conflict("This room is already full", "ROOM_FULL");

  const seat = game.whitePlayer ? "blackPlayer" : "whitePlayer";
  const joined = await GameSession.findOneAndUpdate(
    { _id: game._id, status: "waiting", [seat]: null },
    { $set: { [seat]: user._id, status: "in_progress", clocks: startClocks(game.timeControl) }, $unset: { roomCode: 1 } },
    { new: true }
  );
  if (!joined) throw conflict("Someone else took the seat", "ROOM_FULL");
  await cacheLiveState(joined);
  metrics.activeGames.inc();
  return { game: joined, started: true };
}

export async function createMatchedGame(userA, userB, { timeControl, rated }) {
  const tc = timeControlOf(timeControl);
  const [white, black] = randomInt(2) ? [userA, userB] : [userB, userA];
  const game = await GameSession.create({
    player: white, mode: "online", opponent: "human", playerColor: "w",
    whitePlayer: white, blackPlayer: black, status: "in_progress", rated, timeControl: tc, clocks: startClocks(tc),
  });
  await cacheLiveState(game);
  metrics.gamesCreated.inc({ mode: "online" });
  metrics.activeGames.inc();
  await publish(TOPICS.GAME_CREATED, "game.created", { gameId: String(game._id), mode: "online", whitePlayerId: String(white), blackPlayerId: String(black) });
  return game;
}

const colorOrThrow = (game, userId) => {
  const c = game.colorOf(userId);
  if (!c) throw forbidden("Not a player in this game");
  return c;
};

export async function offerDraw(game, userId) {
  const color = colorOrThrow(game, userId);
  if (game.status !== "in_progress") throw conflict("Game is not in progress", "GAME_NOT_ACTIVE");
  if (game.drawOfferBy && game.drawOfferBy !== color) return { accepted: true, game: await agreeDraw(game) }; // crossing offers
  const updated = await GameSession.findOneAndUpdate({ _id: game._id, status: "in_progress" }, { drawOfferBy: color }, { new: true });
  return { accepted: false, game: updated, by: color };
}

export async function answerDraw(game, userId, accept) {
  const color = colorOrThrow(game, userId);
  if (!game.drawOfferBy || game.drawOfferBy === color) throw conflict("No draw offer from your opponent", "NO_DRAW_OFFER");
  if (accept) return { accepted: true, game: await agreeDraw(game) };
  const updated = await GameSession.findOneAndUpdate({ _id: game._id }, { drawOfferBy: null }, { new: true });
  return { accepted: false, game: updated };
}

// Pause/resume: casual games only; either player may pause, clocks freeze.
export async function setPaused(game, userId, paused) {
  colorOrThrow(game, userId);
  if (game.rated) throw conflict("Rated games can't be paused", "PAUSE_NOT_ALLOWED");
  if (game.status !== "in_progress") throw conflict("Game is not in progress", "GAME_NOT_ACTIVE");
  if (!!game.paused === paused) return game;
  const turn = replay(game).turn();
  const clocks = game.clocks?.whiteMs != null
    ? paused
      ? (({ whiteMs, blackMs }) => ({ whiteMs, blackMs, lastMoveAt: null }))(currentClocks(game, turn))
      : { whiteMs: game.clocks.whiteMs, blackMs: game.clocks.blackMs, lastMoveAt: new Date() }
    : undefined;
  const updated = await GameSession.findOneAndUpdate(
    { _id: game._id, status: "in_progress", paused: !paused },
    { $set: { paused, ...(clocks ? { clocks } : {}) } },
    { new: true }
  );
  if (!updated) return GameSession.findById(game._id);
  await cacheLiveState(updated);
  return updated;
}

// Clock flag check used by the sweeper. Returns the finished game or null.
export async function checkFlag(gameId) {
  const game = await GameSession.findById(gameId);
  if (!game || game.status !== "in_progress" || !game.clocks?.lastMoveAt || game.paused) return null;
  const turn = replay(game).turn();
  const c = currentClocks(game, turn);
  if ((turn === "w" ? c.whiteMs : c.blackMs) > 0) return null;
  return finishGame(game._id, { result: turn === "w" ? "0-1" : "1-0", reason: "timeout" });
}

export async function abandonBy(gameId, userId) {
  const game = await GameSession.findById(gameId);
  if (!game || game.status !== "in_progress") return null;
  const color = game.colorOf(userId);
  if (!color) return null;
  return finishGame(game._id, { result: color === "w" ? "0-1" : "1-0", reason: "abandonment" });
}

export async function abortWaitingRoom(game, userId) {
  if (game.status !== "waiting") return null;
  if (String(game.player) !== String(userId)) throw forbidden("Only the room creator can close it");
  return finishGame(game._id, { result: "*", reason: "aborted" });
}
