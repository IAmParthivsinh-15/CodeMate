import { kv, kvJson } from "../../infrastructure/redis/index.js";
import { publish } from "../../infrastructure/kafka/index.js";
import { TOPICS } from "../../shared/events.js";
import { metrics } from "../../infrastructure/metrics/index.js";
import { TIME_CONTROLS, createMatchedGame } from "../games/online.service.js";
import { badRequest } from "../../shared/errors.js";

// Matchmaking on Redis sorted sets (spec §11.4, §35): one queue per
// (time control, rated), scored by rating. Start simple: the acceptable
// rating gap widens the longer both players wait.

const queueKey = (tc, rated) => `mm:queue:${tc}:${rated ? "rated" : "casual"}`;
const userKey = (userId) => `mm:user:${userId}`;
export const QUEUES = Object.keys(TIME_CONTROLS).flatMap((tc) => [true, false].map((rated) => ({ tc, rated, key: queueKey(tc, rated) })));
const ENTRY_TTL_SEC = 600;

export const allowedGap = (waitMs) => Math.min(600, 100 + 25 * Math.floor(waitMs / 1000));

export async function joinQueue(user, { timeControl, rated = false }) {
  if (!TIME_CONTROLS[timeControl]) throw badRequest("Unknown time control", undefined, "INVALID_TIME_CONTROL");
  await leaveQueue(user._id); // one queue at a time
  const rating = user.chessStats?.rating ?? 800;
  const key = queueKey(timeControl, rated);
  await kvJson.set(userKey(user._id), { key, timeControl, rated, rating, joinedAt: Date.now() }, { ttlSec: ENTRY_TTL_SEC });
  await kv().zadd(key, rating, String(user._id));
  return { queued: true, timeControl, rated, rating };
}

export async function leaveQueue(userId) {
  const entry = await kvJson.get(userKey(userId));
  if (entry) await kv().zrem(entry.key, String(userId));
  await kv().del(userKey(userId));
  return { queued: false };
}

/**
 * One matching pass over every queue. `onMatch(game, [userA, userB])` is
 * called for each pair so the realtime layer can notify both players.
 * Safe with several instances: a pair is only matched if this caller
 * removed BOTH players from the queue.
 */
export async function matchTick(onMatch) {
  const now = Date.now();
  for (const q of QUEUES) {
    const members = await kv().zrangeByScore(q.key, 0, 100000);
    metrics.matchmakingQueue.set({ queue: q.key }, members.length);
    if (members.length < 2) continue;
    const entries = [];
    for (const m of members) {
      const e = await kvJson.get(userKey(m.member));
      if (!e || e.key !== q.key) { await kv().zrem(q.key, m.member); continue; } // expired or moved queue
      entries.push({ userId: m.member, rating: m.score, wait: now - e.joinedAt });
    }
    for (let i = 0; i + 1 < entries.length; i++) {
      const a = entries[i];
      const b = entries[i + 1];
      if (Math.abs(a.rating - b.rating) > Math.min(allowedGap(a.wait), allowedGap(b.wait))) continue;
      const [ra, rb] = [await kv().zrem(q.key, a.userId), await kv().zrem(q.key, b.userId)];
      if (!ra || !rb) {
        if (ra) await kv().zadd(q.key, a.rating, a.userId);
        if (rb) await kv().zadd(q.key, b.rating, b.userId);
        continue;
      }
      await kv().del(userKey(a.userId), userKey(b.userId));
      const game = await createMatchedGame(a.userId, b.userId, { timeControl: q.tc, rated: q.rated });
      await publish(TOPICS.MATCHMAKING_MATCHED, "matchmaking.matched", { gameId: String(game._id), userIds: [a.userId, b.userId], timeControl: q.tc, rated: q.rated });
      await onMatch?.(game, [a.userId, b.userId]);
      i++; // both consumed
    }
  }
}

export async function queueStatus(userId) {
  const e = await kvJson.get(userKey(userId));
  return e ? { queued: true, ...e, waitingMs: Date.now() - e.joinedAt } : { queued: false };
}
