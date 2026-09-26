import KnowledgeChunk from "../knowledgeChunk.model.js";
import { CHESS_COLLECTION } from "./ingest.js";
import { embeddings } from "../../../infrastructure/embeddings/index.js";
import { tokenize } from "../../../infrastructure/embeddings/localEmbedder.js";
import { vectorStore } from "../../../infrastructure/vector/index.js";
import { metrics } from "../../../infrastructure/metrics/index.js";
import { bm25 } from "./bm25.js";

// Query classification for metadata filtering (spec §21). Deterministic
// keyword rules; a topic is only applied as a filter when it is unambiguous.
const TOPIC_RULES = [
  ["endgames", /\b(endgame|end game|lucena|philidor|opposition|king and pawn|rook ending|zugzwang|promote|promotion race|rule of the square)\b/],
  ["openings", /\b(opening|sicilian|french defen[cs]e|caro|queen'?s gambit|italian|ruy lopez|london system|king'?s indian|first (few )?moves|gambit)\b/],
  ["tactics", /\b(fork|pin|skewer|discovered|double attack|deflection|decoy|overload|zwischenzug|tactic|hanging|checkmate pattern|back rank|smothered)\b/],
  ["strategy", /\b(pawn structure|isolated|doubled|backward|passed pawn|outpost|weak square|open file|bishop pair|prophylaxis|centre|center|king safety|piece activity)\b/],
  ["fundamentals", /\b(rules?|notation|castl|en passant|how do(es)? (the )?\w+ move|piece values?|stalemate rule)\b/],
  ["middlegame", /\b(plan|planning|calculat|candidate moves|attack(ing)? the king|when to trade|exchange pieces|time management|clock)\b/],
];

export function classifyChessQuery(q) {
  const text = q.toLowerCase();
  const hits = TOPIC_RULES.filter(([, re]) => re.test(text)).map(([t]) => t);
  return { topic: hits.length === 1 ? hits[0] : null, topics: hits };
}

const lexicalOverlap = (queryTokens, text) => {
  if (!queryTokens.length) return 0;
  const t = new Set(tokenize(text));
  return queryTokens.filter((q) => t.has(q)).length / queryTokens.length;
};

const toResult = (payload, score) => ({
  chunkId: payload.chunkId,
  title: payload.title,
  section: payload.section,
  source: payload.source,
  topic: payload.topic,
  subcategory: payload.subcategory,
  difficulty: payload.difficulty,
  text: payload.text,
  score: Math.round(score * 1000) / 1000,
});

// Reciprocal rank fusion constant (standard value from the RRF paper).
const RRF_K = 60;

/**
 * Runtime retrieval (spec §21), hybrid:
 *   vector search (semantic)  ─┐
 *                              ├─ reciprocal rank fusion → metadata boost → top-k
 *   BM25 keyword search       ─┘
 * An unambiguous topic becomes a metadata filter; if it leaves too little,
 * the unfiltered search is used instead.
 */
export async function retrieveKnowledge(query, { limit = 4, topic, candidates = 20 } = {}) {
  const end = metrics.ragRetrieval.startTimer({ rag: "chess" });
  try {
    const store = vectorStore();
    const vector = await embeddings.embedQuery(query);
    const cls = classifyChessQuery(query);
    const useTopic = topic || cls.topic;
    const run = async (filter) => [
      await store.search(CHESS_COLLECTION, vector, { limit: candidates, filter }),
      bm25().search(query, { limit: candidates, filter }),
    ];
    let [vec, kw] = await run(useTopic ? { topic: useTopic } : undefined);
    if (useTopic && vec.length + kw.length < 4) [vec, kw] = await run(undefined);

    const fused = new Map();
    const add = (hits, weight) => hits.forEach((h, rank) => {
      const e = fused.get(h.id) || { payload: h.payload, score: 0 };
      e.score += weight / (RRF_K + rank + 1);
      fused.set(h.id, e);
    });
    add(vec, 1);
    add(kw, 1);

    // Small boost when the question names the document's own subject.
    const qTokens = [...new Set(tokenize(query))];
    const ranked = [...fused.values()]
      .map((e) => {
        const meta = `${e.payload.title} ${e.payload.subcategory.replace(/_/g, " ")} ${(e.payload.tags || []).join(" ")}`;
        return { ...e, score: e.score * (1 + 0.5 * lexicalOverlap(qTokens, meta)) };
      })
      .sort((x, y) => y.score - x.score);

    // At most two chunks per document so answers can draw on several sources.
    const perDoc = new Map();
    const out = [];
    for (const e of ranked) {
      const n = perDoc.get(e.payload.documentId) || 0;
      if (n >= 2) continue;
      perDoc.set(e.payload.documentId, n + 1);
      out.push(toResult(e.payload, e.score * RRF_K)); // rescaled to roughly 0-2 for readability
      if (out.length >= limit) break;
    }
    return { chunks: out, classification: cls, appliedTopic: useTopic || null };
  } finally {
    end();
  }
}

/**
 * Theme-driven retrieval for game explanations: fetch sections of specific
 * corpus documents (from THEME_KNOWLEDGE) and rank them against the question.
 */
export async function retrieveFromSources(sources, query, { limit = 3 } = {}) {
  if (!sources.length) return [];
  const chunks = await KnowledgeChunk.find({ source: { $in: sources } }).lean();
  const qTokens = [...new Set(tokenize(query))];
  const preferred = /what to look for|how to spot|next time|key takeaway|definition/i;
  return chunks
    .map((c) => ({ c, score: lexicalOverlap(qTokens, c.text) + (preferred.test(c.section) ? 0.3 : 0) + (sources.indexOf(c.source) === 0 ? 0.1 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c, score }) => toResult(c, score));
}

export const sourcesOf = (chunks) => {
  const seen = new Set();
  return chunks
    .filter((c) => !seen.has(`${c.title}|${c.section}`) && seen.add(`${c.title}|${c.section}`))
    .map((c) => ({ title: c.title, section: c.section, source: c.source }));
};
