import { tokenize } from "../../../infrastructure/embeddings/localEmbedder.js";

// Keyword side of hybrid retrieval: Okapi BM25 over every knowledge chunk.
// The corpus is small (hundreds of chunks), so the index lives in memory and
// is rebuilt whenever the corpus is (re)ingested.
const K1 = 1.2;
const B = 0.75;

export class Bm25Index {
  constructor(docs = []) { this.build(docs); }

  /** @param {{id:string, text:string, title?:string, section?:string, tags?:string[], payload:any}[]} docs */
  build(docs) {
    this.docs = docs.map((d) => {
      // Title, section and tags are repeated so they weigh more than body text.
      const tokens = tokenize(`${d.title || ""} ${d.title || ""} ${d.section || ""} ${(d.tags || []).join(" ")} ${(d.tags || []).join(" ")} ${d.text}`);
      const tf = new Map();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
      return { id: d.id, payload: d.payload, len: tokens.length, tf };
    });
    this.avgLen = this.docs.reduce((a, d) => a + d.len, 0) / (this.docs.length || 1);
    this.df = new Map();
    for (const d of this.docs) for (const t of d.tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
  }

  get size() { return this.docs.length; }

  search(query, { limit = 20, filter } = {}) {
    const q = [...new Set(tokenize(query))];
    const N = this.docs.length;
    const out = [];
    for (const d of this.docs) {
      if (filter && !Object.entries(filter).every(([k, v]) => d.payload[k] === v)) continue;
      let score = 0;
      for (const t of q) {
        const f = d.tf.get(t);
        if (!f) continue;
        const n = this.df.get(t);
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / this.avgLen)));
      }
      if (score > 0) out.push({ id: d.id, score, payload: d.payload });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

let index = new Bm25Index();
export const bm25 = () => index;
export const setBm25Index = (docs) => { index = new Bm25Index(docs); return index; };
