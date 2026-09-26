import { rateLimit } from "express-rate-limit";
import { kv } from "../infrastructure/redis/index.js";
import { isTest } from "../config/env.js";

// express-rate-limit store backed by our KV adapter, so limits are shared
// across instances whenever Redis is configured (spec §11.5).
class KvRateStore {
  constructor(prefix) { this.prefix = `ratelimit:${prefix}:`; }
  init(options) { this.windowSec = Math.ceil(options.windowMs / 1000); }
  async increment(key) {
    const { count, ttlMs } = await kv().incr(this.prefix + key, this.windowSec);
    return { totalHits: count, resetTime: new Date(Date.now() + Math.max(ttlMs, 0)) };
  }
  async decrement(key) { await kv().decr(this.prefix + key); }
  async resetKey(key) { await kv().del(this.prefix + key); }
}

const make = (name, { windowMs, limit }) =>
  rateLimit({
    windowMs,
    limit: isTest ? 10_000 : limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: new KvRateStore(name),
    keyGenerator: (req) => (req.user?._id ? `u:${req.user._id}` : `ip:${req.ip}`),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) =>
      res.status(429).json({
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many requests, slow down." },
        message: "Too many requests, slow down.",
        requestId: req.id,
      }),
  });

export const limiters = {
  auth: make("auth", { windowMs: 15 * 60_000, limit: 30 }),
  ai: make("ai", { windowMs: 60_000, limit: 20 }),
  code: make("code", { windowMs: 60_000, limit: 10 }),
  analysis: make("analysis", { windowMs: 60_000, limit: 6 }),
  general: make("general", { windowMs: 60_000, limit: 300 }),
};
