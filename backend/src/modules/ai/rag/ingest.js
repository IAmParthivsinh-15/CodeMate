import { createHash } from "crypto";
import KnowledgeChunk from "../knowledgeChunk.model.js";
import { loadCorpus, chunkDocument, CORPUS_DIR } from "./corpus.js";
import { embeddings } from "../../../infrastructure/embeddings/index.js";
import { vectorStore } from "../../../infrastructure/vector/index.js";
import { childLogger } from "../../../infrastructure/logger/index.js";
import { setBm25Index } from "./bm25.js";

const log = childLogger("rag-ingest");
export const CHESS_COLLECTION = "chess_knowledge";

const payloadOf = (c) => ({
  chunkId: c.chunkId, documentId: c.documentId, source: c.source, title: c.title, topic: c.topic,
  subcategory: c.subcategory, difficulty: c.difficulty, section: c.section, tags: c.tags, text: c.text,
});

/**
 * Ingestion pipeline (spec §19), separate from runtime chat:
 * load → clean → chunk → enrich metadata → embed (changed chunks only) → upsert.
 * Idempotent; chunks removed from the corpus are deleted.
 */
export async function ingestCorpus({ force = false, dir = CORPUS_DIR } = {}) {
  const docs = loadCorpus(dir);
  const chunks = docs.flatMap((d) => chunkDocument(d));
  const modelId = embeddings.modelId;
  for (const c of chunks) c.hash = createHash("sha256").update(`${modelId}\n${c.text}`).digest("hex");

  const existing = new Map((await KnowledgeChunk.find().select("chunkId hash").lean()).map((c) => [c.chunkId, c.hash]));
  const changed = chunks.filter((c) => force || existing.get(c.chunkId) !== c.hash);
  const removed = [...existing.keys()].filter((id) => !chunks.some((c) => c.chunkId === id));

  const store = vectorStore();
  await store.ensureCollection(CHESS_COLLECTION, embeddings.dimension);

  if (changed.length) {
    const vectors = await embeddings.embedDocuments(changed.map((c) => c.text));
    await KnowledgeChunk.bulkWrite(
      changed.map((c, i) => ({
        updateOne: {
          filter: { chunkId: c.chunkId },
          update: { $set: { ...payloadOf(c), hash: c.hash, embeddingModel: modelId, embedding: vectors[i] } },
          upsert: true,
        },
      }))
    );
    await store.upsert(CHESS_COLLECTION, changed.map((c, i) => ({ id: c.chunkId, vector: vectors[i], payload: payloadOf(c) })));
  }
  if (removed.length) {
    await KnowledgeChunk.deleteMany({ chunkId: { $in: removed } });
    await store.delete(CHESS_COLLECTION, removed);
  }
  await refreshKeywordIndex();
  const stats = { documents: docs.length, chunks: chunks.length, embedded: changed.length, removed: removed.length, model: modelId, store: store.kind };
  log.info(stats, "Chess knowledge ingestion complete");
  return stats;
}

// Keyword (BM25) half of hybrid retrieval, built from the stored chunks.
export async function refreshKeywordIndex() {
  const chunks = await KnowledgeChunk.find().lean();
  return setBm25Index(chunks.map((c) => ({ id: c.chunkId, text: c.text, title: c.title, section: c.section, tags: c.tags, payload: payloadOf(c) })));
}

/**
 * Startup: the in-memory store is empty after every restart, so load the
 * stored embeddings from MongoDB (no re-embedding). If MongoDB has no chunks
 * yet, or they were embedded with another model, run ingestion (local
 * embeddings only; remote providers need an explicit `npm run ingest`).
 */
export async function ensureKnowledgeIndex() {
  const store = vectorStore();
  const count = await KnowledgeChunk.countDocuments();
  const staleModel = count && (await KnowledgeChunk.exists({ embeddingModel: { $ne: embeddings.modelId } }));
  if (!count || staleModel) {
    if (embeddings.modelId.startsWith("local")) return ingestCorpus();
    log.warn("Knowledge index is empty or stale; run `npm run ingest` to embed the corpus");
    await refreshKeywordIndex(); // keyword retrieval still works meanwhile
    return null;
  }
  if (store.kind === "memory") {
    await store.ensureCollection(CHESS_COLLECTION, embeddings.dimension);
    const docs = await KnowledgeChunk.find().select("+embedding").lean();
    await store.upsert(CHESS_COLLECTION, docs.map((d) => ({ id: d.chunkId, vector: d.embedding, payload: payloadOf(d) })));
    log.info({ chunks: docs.length }, "Loaded knowledge index into memory");
  }
  // Pick up corpus edits made since the last run (cheap: hashes only).
  return ingestCorpus();
}
