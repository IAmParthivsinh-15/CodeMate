# CodeMate Real-time Protocol (Socket.IO)

> Online play, matchmaking, presence and live notifications. Implemented in `backend/src/sockets/index.js`.

## Connecting

```js
import { io } from "socket.io-client";
const socket = io(BACKEND_ORIGIN, {
  withCredentials: true,        // sends the httpOnly jwt cookie on same-origin setups
  auth: { token: accessToken }, // or pass the access token explicitly
  transports: ["websocket", "polling"],
});
```

- **Authentication.** The handshake is rejected with `connect_error` (`err.data.code`, e.g. `NO_TOKEN`, `TOKEN_EXPIRED`) unless the token is valid. On `TOKEN_EXPIRED`, refresh over REST and reconnect.
- **Session.** After connecting, the server emits `session`: `{ userId, activeGames: string[] }`. The socket has automatically rejoined the rooms of those active games.
- **Heartbeat.** Send `presence:heartbeat` every 25 s. Presence expires after 60 s without one. Socket.IO's own ping (every 20 s) detects dead connections.

## Request and acknowledgement

Every client-to-server event takes a payload and an acknowledgement callback:

```js
socket.emit("game:move", { gameId, move: { from: "e2", to: "e4" }, clientMoveId, expectedPly }, (ack) => {
  if (!ack.ok) showError(ack.error.code, ack.error.message);
});
```

`ack` is `{ ok: true, ...data }` or `{ ok: false, error: { code, message } }`. Error codes are the same as the REST API's.

## The server is authoritative (spec §10)

The client never decides legality, turn, result, clocks or identity. It proposes moves, and renders `game:state`, which is the only source of truth.

```ts
interface LiveState {
  gameId: string; mode: "online"; status: "waiting" | "in_progress" | "completed" | "abandoned";
  result: string; endReason: string | null;
  fen: string; turn: "w" | "b"; ply: number; inCheck: boolean;
  lastMove: { san: string; uci: string } | null;
  whitePlayerId: string | null; blackPlayerId: string | null;
  clocks: { whiteMs: number; blackMs: number; turn: "w" | "b"; running: boolean; serverTime: number } | null;
  paused: boolean; drawOfferBy: "w" | "b" | null;
  move?: { ply, san, uci, color, fen, clockMs };   // present when the state follows a move
}
```

**Clocks.** Display `clocks.whiteMs` / `blackMs` minus the time elapsed since `serverTime` for the side to move (only while `running`). The server alone detects flag fall.

## Client → server events

| Event | Payload | Ack data |
| :-- | :-- | :-- |
| `room:create` | `{ timeControl: "1+0" \| "3+2" \| "5+0" \| "10+0" \| "15+10", rated?: boolean, color?: "white" \| "black" \| "random" }` | `{ game }` (REST `Game` shape, with `roomCode`, `status: "waiting"`) |
| `room:join` | `{ roomCode }` or `{ gameId }` | `{ game, started }`. Rejoining a game you're in is allowed. |
| `room:ready` | `{ gameId }` | `{ game, state }`: subscribes this socket to the room (use on page load) |
| `room:leave` | `{ gameId }` | `{}`. A waiting room you created is closed. |
| `game:state` | `{ gameId }` | `{ state }`: resync after reconnecting or a `STALE_POSITION` error |
| `game:move` | `{ gameId, move: MoveInput, clientMoveId: string, expectedPly?: number }` | `{ state, move }`, or `{ duplicate: true, state }` |
| `game:resign` | `{ gameId }` | `{ state }` |
| `draw:offer` | `{ gameId }` | `{ accepted }`. Crossing offers are accepted immediately. |
| `draw:accept` / `draw:reject` | `{ gameId }` | `{ state }` |
| `game:pause` / `game:resume` | `{ gameId }` | `{ state }`. Casual (unrated) games only; clocks freeze. |
| `matchmaking:join` | `{ timeControl, rated? }` | `{ queued: true, timeControl, rated, rating }` |
| `matchmaking:leave` | — | `{ queued: false }` |
| `matchmaking:status` | — | `{ queued, waitingMs?, ... }` |
| `presence:heartbeat` | — | `{ serverTime }` |
| `presence:query` | `{ userIds: string[] }` (max 50) | `{ presence: { [userId]: boolean } }` |

### Idempotency and ordering (spec §37)

- **`clientMoveId`** (for example a UUID per attempted move): a repeated id is not applied again. The ack says `duplicate: true` and includes the current state. Safe to resend after a timeout.
- **`expectedPly`**: the ply you believe the game is at. If it doesn't match, the server answers `STALE_POSITION`; call `game:state` and re-render.
- Two simultaneous moves on one game can't both be written (a conditional update on `ply`). The loser gets `CONCURRENT_MOVE`.

## Server → client events

| Event | Payload | When |
| :-- | :-- | :-- |
| `session` | `{ userId, activeGames }` | On connect |
| `game:start` | `{ gameId, state }` | A room filled up, or matchmaking paired you |
| `room:joined` | `{ gameId, opponent: { _id, username } }` | To the room creator |
| `game:state` | `LiveState` | After every accepted move and every state change |
| `game:finish` | `{ gameId, result, reason, ratingChange, state }` | Checkmate, draw, resignation, timeout or abandonment |
| `draw:offer` | `{ gameId, by }` | The opponent offered a draw |
| `draw:reject` | `{ gameId }` | Your offer was declined |
| `game:pause` / `game:resume` | `{ gameId, by }` | |
| `player:disconnected` | `{ gameId, userId, graceMs: 60000 }` | Show "Opponent disconnected" |
| `player:reconnected` | `{ gameId, userId }` | Show "Opponent reconnected" |
| `matchmaking:matched` | `{ gameId }` | Navigate to `/play/online/:gameId` |
| `analysis:update` | `{ gameId, status?, aiStatus?, puzzles? }` | Background analysis progress |
| `submission:update` | `{ submissionId, status, firstAccept? }` | Code judging progress |

## Disconnects, reconnects and cleanup

1. When a player's last socket disconnects during a game, the opponent gets `player:disconnected` with a 60-second grace period.
2. If the player reconnects within the grace period, they rejoin the game rooms automatically, the opponent gets `player:reconnected`, and `game:state` restores everything: position, turn, clocks, presence and status.
3. If they don't, the game ends with `endReason: "abandonment"` (a loss for the absent player).
4. Waiting rooms that nobody joins are closed after 30 minutes.
5. A once-per-second sweeper handles flag fall, abandonment, stale rooms and matchmaking. With several instances, a Redis lock ensures only one runs each tick.

## Scaling

With `REDIS_URL` set, the Socket.IO Redis adapter shares rooms across realtime instances, so a move handled by instance A reaches sockets on instance B. Without Redis, run a single realtime instance.
