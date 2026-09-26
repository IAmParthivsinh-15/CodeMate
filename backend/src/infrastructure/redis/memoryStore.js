// In-process stand-in for Redis, used when REDIS_URL is empty (dev, tests,
// single-instance deploys). Implements exactly the subset of commands that
// infrastructure/redis/index.js exposes. Not shared across processes.
export class MemoryStore {
  constructor() {
    this.kind = "memory";
    this.data = new Map(); // key -> { value, expiresAt }
    this.zsets = new Map(); // key -> Map(member -> score)
  }

  #alive(key) {
    const e = this.data.get(key);
    if (!e) return undefined;
    if (e.expiresAt && e.expiresAt <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }

  async get(key) { return this.#alive(key)?.value ?? null; }

  async set(key, value, { ttlSec, nx } = {}) {
    if (nx && this.#alive(key)) return false;
    this.data.set(key, { value: String(value), expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : null });
    return true;
  }

  async del(...keys) {
    let n = 0;
    for (const k of keys) n += (this.data.delete(k) ? 1 : 0) + (this.zsets.delete(k) ? 1 : 0);
    return n;
  }

  async incr(key, ttlSec) {
    const e = this.#alive(key);
    const next = (e ? parseInt(e.value, 10) : 0) + 1;
    const expiresAt = e?.expiresAt ?? (ttlSec ? Date.now() + ttlSec * 1000 : null);
    this.data.set(key, { value: String(next), expiresAt });
    return { count: next, ttlMs: expiresAt ? expiresAt - Date.now() : -1 };
  }

  async decr(key) {
    const e = this.#alive(key);
    if (!e) return 0;
    e.value = String(Math.max(0, parseInt(e.value, 10) - 1));
    return Number(e.value);
  }

  async expire(key, ttlSec) {
    const e = this.#alive(key);
    if (e) e.expiresAt = Date.now() + ttlSec * 1000;
  }

  async zadd(key, score, member) {
    if (!this.zsets.has(key)) this.zsets.set(key, new Map());
    this.zsets.get(key).set(member, score);
  }

  async zrem(key, member) { return this.zsets.get(key)?.delete(member) ? 1 : 0; }

  async zrangeByScore(key, min, max) {
    const z = this.zsets.get(key);
    if (!z) return [];
    return [...z.entries()]
      .filter(([, s]) => s >= min && s <= max)
      .sort((a, b) => a[1] - b[1])
      .map(([m, s]) => ({ member: m, score: s }));
  }

  async zcard(key) { return this.zsets.get(key)?.size ?? 0; }

  async ping() { return "PONG"; }
  async quit() {}
}
