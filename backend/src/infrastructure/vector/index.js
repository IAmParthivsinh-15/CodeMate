import { createHash } from "crypto";
import { env } from "../../config/env.js";
import { childLogger } from "../logger/index.js";

const log = childLogger("vector");

// Vector store abstraction (spec §20): Qdrant when VECTOR_DB_URL is set,
// otherwise an in-process index rebuilt from MongoDB at startup. Only one
// vector store is used for a workload.

const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};

const matches = (payload, filter = {}) =>
  Object.entries(filter).every(([k, v]) => (Array.isArray(v) ? v.includes(payload[k]) : payload[k] === v));

class MemoryVectorStore {
  constructor() { this.kind = "memory"; this.collections = new Map(); }
  async ensureCollection(name) { if (!this.collections.has(name)) this.collections.set(name, new Map()); }
  async upsert(name, points) {
    await this.ensureCollection(name);
    const c = this.collections.get(name);
    for (const p of points) c.set(p.id, p);
  }
  async delete(name, ids) { const c = this.collections.get(name); ids.forEach((id) => c?.delete(id)); }
  async count(name) { return this.collections.get(name)?.size ?? 0; }
  async search(name, vector, { limit = 10, filter } = {}) {
    const c = this.collections.get(name);
    if (!c) return [];
    const out = [];
    for (const p of c.values()) if (matches(p.payload, filter)) out.push({ id: p.id, score: cosine(vector, p.vector), payload: p.payload });
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

// Qdrant point ids must be UUIDs or integers: derive a stable UUID from our id.
const toUuid = (id) => {
  const h = createHash("sha1").update(id).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

class QdrantStore {
  constructor(url, apiKey) {
    this.kind = "qdrant";
    this.url = url.replace(/\/$/, "");
    this.headers = { "content-type": "application/json", ...(apiKey ? { "api-key": apiKey } : {}) };
  }
  async #req(method, path, body) {
    const res = await fetch(`${this.url}${path}`, { method, headers: this.headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    if (!res.ok && res.status !== 404) throw new Error(`qdrant ${method} ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.status === 404 ? null : res.json();
  }
  async ensureCollection(name, dim) {
    const existing = await this.#req("GET", `/collections/${name}`);
    const size = existing?.result?.config?.params?.vectors?.size;
    if (size && size !== dim) {
      log.warn({ name, size, dim }, "Qdrant collection has a different dimension; recreating");
      await this.#req("DELETE", `/collections/${name}`);
    } else if (size) return;
    await this.#req("PUT", `/collections/${name}`, { vectors: { size: dim, distance: "Cosine" } });
    for (const field of ["topic", "subcategory", "source"]) {
      await this.#req("PUT", `/collections/${name}/index`, { field_name: field, field_schema: "keyword" });
    }
  }
  async upsert(name, points) {
    for (let i = 0; i < points.length; i += 128) {
      await this.#req("PUT", `/collections/${name}/points?wait=true`, {
        points: points.slice(i, i + 128).map((p) => ({ id: toUuid(p.id), vector: p.vector, payload: { ...p.payload, _id: p.id } })),
      });
    }
  }
  async delete(name, ids) {
    if (ids.length) await this.#req("POST", `/collections/${name}/points/delete?wait=true`, { points: ids.map(toUuid) });
  }
  async count(name) { return (await this.#req("POST", `/collections/${name}/points/count`, { exact: true }))?.result?.count ?? 0; }
  async search(name, vector, { limit = 10, filter } = {}) {
    const must = Object.entries(filter || {}).map(([key, v]) => (Array.isArray(v) ? { key, match: { any: v } } : { key, match: { value: v } }));
    const r = await this.#req("POST", `/collections/${name}/points/search`, { vector, limit, with_payload: true, ...(must.length ? { filter: { must } } : {}) });
    return (r?.result || []).map((p) => ({ id: p.payload._id, score: p.score, payload: p.payload }));
  }
}

let store;
export const vectorStore = () =>
  store || (store = env.VECTOR_DB_URL ? new QdrantStore(env.VECTOR_DB_URL, env.VECTOR_DB_API_KEY) : new MemoryVectorStore());
export const __resetVectorStore = () => { store = undefined; };
