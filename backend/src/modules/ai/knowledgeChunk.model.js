import mongoose from "mongoose";

// Ingestion manifest for the Chess Knowledge corpus. `hash` lets re-ingestion
// skip unchanged chunks (no repeated embedding calls, spec §56). The embedding
// is kept here so the in-memory vector index can be rebuilt at startup without
// re-embedding; with Qdrant the vector also lives in the collection.
const knowledgeChunkSchema = new mongoose.Schema(
  {
    chunkId: { type: String, required: true, unique: true },
    documentId: { type: String, required: true, index: true },
    source: String, // e.g. tactics/pin.md
    title: String,
    topic: String,
    subcategory: String,
    difficulty: String,
    section: String,
    tags: [String],
    text: String,
    hash: String,
    embeddingModel: String,
    embedding: { type: [Number], select: false },
  },
  { timestamps: true }
);

export default mongoose.model("KnowledgeChunk", knowledgeChunkSchema);
