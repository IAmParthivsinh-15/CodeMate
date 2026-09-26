# Chess Knowledge RAG

> Answers "teach me chess" questions, independently of any user's games (spec §17). Endpoint: `POST /api/chess/chat`. Code: `backend/src/modules/ai/rag/`.

## Corpus

`ai/corpus/chess-knowledge/<topic>/<subcategory>.md`: 47 original documents (about 23.5k words) in six topics: fundamentals, tactics, strategy, openings, middlegame, endgames. Each file has frontmatter:

```yaml
title: Pin
topic: tactics          # = folder
subcategory: pin        # = filename
difficulty: beginner    # beginner | intermediate | advanced
tags: [pin, absolute pin, relative pin]
```

Each file has 3–6 `##` sections, and every section makes sense on its own (the concept is named again in its first sentence). Every document has a "How to spot it / What to look for next time" section, which explain-move and the coach reuse. The content was written for CodeMate; no copyrighted books are ingested (spec §18). Concrete move sequences were replayed with chess.js when the corpus was written. Prose-only strategic claims should still get a review from a strong player.

## Ingestion (offline, spec §19)

`npm run ingest` (and automatically at startup when using local embeddings):

```text
load .md → parse frontmatter → clean (drop H1, normalise whitespace)
  → chunk on "## " headings (long sections split by paragraph, 1-paragraph overlap, ≤1200 chars)
  → enrich: { chunkId, documentId, source, title, topic, subcategory, difficulty, section, tags }
  → hash(model + text) → embed ONLY new or changed chunks → upsert (MongoDB manifest + vector store)
  → delete chunks that disappeared → rebuild BM25 keyword index
```

The result is currently 228 chunks. Re-running with an unchanged corpus embeds nothing (spec §56).

## Retrieval (runtime, spec §21)

```text
question
  → query classification (rules): an unambiguous topic becomes a metadata filter
  → embed query ─→ vector search top-20 ─┐
  → BM25 keyword search top-20 ──────────┴→ reciprocal rank fusion (k=60)
  → boost when the question names the document's subject (title / subcategory / tags)
  → at most 2 chunks per document → top 4 → context with [Title / Section] labels
```

If a topic filter leaves fewer than 4 candidates, the search is re-run without it.

## Answering

The `chess-chat` prompt ([ai/prompts/chess-chat.md](../../ai/prompts/chess-chat.md)) goes to the LLM gateway on the small tier, with JSON output validated by zod (`{ answer, keyConcepts, recommendations }`). **Sources come from retrieval, never from the model.** With no LLM configured, or if the call fails, the answer is the top chunk's text plus related topics, with `degraded: true`. First-turn answers are cached in Redis for an hour (`ai:response:chess:*`), keyed by question, player level and provider.

## Embeddings and vector store

| Setting | Behaviour |
| :-- | :-- |
| `EMBEDDING_PROVIDER=local` (default) | Offline feature-hashing embedder (1024-d) with chess synonym and phrase normalisation. Lexical, not truly semantic, which is why BM25 fusion matters. |
| `gemini` / `nvidia` | Remote semantic embeddings. Changing the provider changes the model id in the hash, so the next ingest re-embeds everything. |
| `VECTOR_DB_URL` empty | In-memory index, loaded from the MongoDB manifest at startup (no re-embedding) |
| `VECTOR_DB_URL` set | Qdrant collection `chess_knowledge` (cosine), with payload indexes on topic, subcategory and source |

Only one vector store serves a workload (spec §20).

## Evaluation (spec §57)

`npm run rag:eval` runs the 40 questions in `ai/evaluation/chess-rag-eval.json`. 36 of them avoid the subcategory's own word, to test paraphrase. It reports hit@1, hit@k, MRR, concept coverage and latency.

Measured on 2026-09-26 with local embeddings and the in-memory store:

| Configuration | hit@1 | hit@4 | MRR | Concept coverage | p50 latency |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Vector + lexical rerank (first version) | 60.0% | 77.5% | 0.677 | 74.7% | 2.8 ms |
| **Hybrid BM25 + vector with RRF, phrase normalisation (current)** | **72.5%** | **85.0%** | **0.775** | **82.3%** | 2.7 ms |

The remaining misses are paraphrases with no shared vocabulary (for example "why can't my knight move when… bishop behind it" should find *pin*). These are the cases remote semantic embeddings are meant for. Run the evaluation again after switching `EMBEDDING_PROVIDER`. Numbers with remote embeddings have **not** been measured yet.
