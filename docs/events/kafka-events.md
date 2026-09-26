# Domain Events (Kafka)

Implemented in `backend/src/shared/events.js` (names and envelope) and `backend/src/infrastructure/kafka/` (the Kafka bus, and an in-process bus used when `KAFKA_BROKERS` is empty). Consumers are in `backend/src/workers/index.js`.

## Envelope (spec §27)

```json
{
  "eventId": "8a1f…uuid",
  "eventType": "game.finished",
  "version": 1,
  "timestamp": "2026-09-26T10:00:00.000Z",
  "payload": { "gameId": "…" }
}
```

- Payloads carry **ids and small facts**, never whole documents. Consumers load what they need from MongoDB.
- **Message key:** `payload.gameId`, else `payload.userId`, else `eventId`, so all events for one game stay ordered within a partition.
- **Versioning:** add optional fields freely. For a breaking change, bump `version`, have consumers accept both versions, then retire the old one.
- **Delivery:** at-least-once. Each handler retries twice, then logs and skips, so a poison message can't block a partition. Every handler is idempotent (see below).
- **Topics** are created on connect with 3 partitions (`KafkaBus.ensureTopics`), or by `infrastructure/kafka/create-topics.sh` in docker compose.

## Topics

| Topic | Producer | Payload | Consumers (group) |
| :-- | :-- | :-- | :-- |
| `codemate.game.created` | games | `{ gameId, mode, playerId? , whitePlayerId?, blackPlayerId? }` | none yet (audit/analytics hook) |
| `codemate.game.move` | games | `{ gameId, ply, san, by }` | none yet (live spectating / analytics hook) |
| `codemate.game.finished` | `finishGame()` | `{ gameId, mode, playerId, whitePlayerId, blackPlayerId, result, reason, plies }` | `analysis-worker` (auto-analysis when plies ≥ 6 and `AUTO_ANALYZE`), `analytics-worker` (cache invalidation) |
| `codemate.analysis.requested` | `POST /api/games/:id/analyze` | `{ gameId, requestedBy }` | `analysis-worker` |
| `codemate.analysis.completed` | analysis service | `{ gameId, analysisId, userIds, significantMoves }` | `ai-worker` (report), `analytics-worker` (UserStats) |
| `codemate.code.submitted` | `POST /api/coding/submissions` | `{ submissionId, userId, problemId }` | `coding-worker` |
| `codemate.code.completed` | coding worker | `{ submissionId, userId, problemId, status, kind, firstAccept }` | `analytics-worker` |
| `codemate.ai.chat.completed` | AI chat | `{ userId, scope, gameId, concepts, degraded }` | `analytics-worker` (questions, concepts) |
| `codemate.matchmaking.matched` | matchmaking | `{ gameId, userIds, timeControl, rated }` | none yet |
| `codemate.rating.updated` | `finishGame()` | `{ userId, gameId, before, after }` | `analytics-worker` (leaderboard cache) |

`codemate.ai.chat.requested` from the spec's list is **not** published: chat is answered synchronously, and spec §26 says not to put every API call on Kafka.

## Idempotency per consumer

| Consumer | Guard |
| :-- | :-- |
| analysis | Redis lock `analysis:lock:{gameId}`, plus "completed with the current thresholds version → skip" |
| puzzles | Unique index `(user, sourceGame, sourcePly)` with `$setOnInsert` |
| ai report | `aiStatus === completed → skip` |
| coding | Atomic claim `status: queued → running` |
| analytics | `processedEvents` key per analysis or event on `UserStats` |
| ratings | Unique index `(user, game)` on `RatingHistory` |

## Operations

- **Lag:** exported every 30 s as `kafka_consumer_lag{group,topic}`. Alert at > 500 for 10 min (`infrastructure/prometheus/alerts.yml`).
- **Replaying analysis** for a game: `POST /api/games/:id/analyze`. Rebuilding analytics: `npm run stats:rebuild`.
