import { env } from "../../config/env.js";
import { childLogger } from "../logger/index.js";
import { MemoryStore } from "./memoryStore.js";

const log = childLogger("redis");

// Thin adapter so the rest of the code never depends on ioredis directly.
class RedisStore {
  constructor(client) {
    this.kind = "redis";
    this.client = client;
  }
  get(key) { return this.client.get(key); }
  async set(key, value, { ttlSec, nx } = {}) {
    const args = [key, String(value)];
    if (ttlSec) args.push("EX", ttlSec);
    if (nx) args.push("NX");
    return (await this.client.set(...args)) === "OK";
  }
  del(...keys) { return keys.length ? this.client.del(...keys) : 0; }
  async incr(key, ttlSec) {
    const [[, count], [, pttl]] = await this.client.multi().incr(key).pttl(key).exec();
    if (pttl === -1 && ttlSec) await this.client.expire(key, ttlSec);
    return { count, ttlMs: pttl === -1 ? ttlSec * 1000 : pttl };
  }
  decr(key) { return this.client.decr(key); }
  expire(key, ttlSec) { return this.client.expire(key, ttlSec); }
  zadd(key, score, member) { return this.client.zadd(key, score, member); }
  zrem(key, member) { return this.client.zrem(key, member); }
  async zrangeByScore(key, min, max) {
    const flat = await this.client.zrangebyscore(key, min, max, "WITHSCORES");
    const out = [];
    for (let i = 0; i < flat.length; i += 2) out.push({ member: flat[i], score: Number(flat[i + 1]) });
    return out;
  }
  zcard(key) { return this.client.zcard(key); }
  ping() { return this.client.ping(); }
  quit() { return this.client.quit(); }
}

let store;
let redisClient;

export async function connectKv() {
  if (store) return store;
  if (!env.REDIS_URL) {
    log.info("REDIS_URL not set: using in-memory store (single process only)");
    store = new MemoryStore();
    return store;
  }
  const { default: Redis } = await import("ioredis");
  redisClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
  redisClient.on("error", (err) => log.error({ err }, "Redis error"));
  await redisClient.connect();
  log.info("Connected to Redis");
  store = new RedisStore(redisClient);
  return store;
}

// Synchronous accessor for modules that run after startup. Falls back to an
// in-memory store so unit tests that never call connectKv() still work.
export const kv = () => store || (store = new MemoryStore());

// Raw ioredis client (null in memory mode) for the Socket.IO adapter.
export const rawRedis = () => redisClient || null;

export const kvJson = {
  async get(key) {
    const v = await kv().get(key);
    return v ? JSON.parse(v) : null;
  },
  set(key, value, opts) { return kv().set(key, JSON.stringify(value), opts); },
};

export async function closeKv() {
  if (store) await store.quit();
  store = undefined;
  redisClient = undefined;
}
