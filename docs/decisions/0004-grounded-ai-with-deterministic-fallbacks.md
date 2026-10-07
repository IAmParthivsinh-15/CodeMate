# ADR 0004: Grounded AI with deterministic fallbacks and hybrid retrieval

- **Status:** Accepted
- **Date:** 2026-09-26
- **Spec reference:** §22 (hybrid routing), §25 (grounding), §56 (don't call an LLM when deterministic is enough), §57 (RAG quality), §59 (structured output)

## Decisions

1. **Rules, not LLMs, for control flow.** Intent routing, move selection, theme detection, move classification, puzzle generation and every coach metric are deterministic code over stored data. The LLM only phrases explanations.
2. **Validated structured output.** Every LLM task returns JSON validated with zod (one retry on bad JSON). Sources are attached from retrieval, never taken from the model.
3. **A numeric grounding guard.** If an answer contains an evaluation that isn't among the engine facts, it's discarded and the deterministic answer is used. This deliberately prefers a plainer answer over an invented number.
4. **Every AI feature works with `LLM_PROVIDER=none`.** Fallbacks are composed from Stockfish facts and corpus sections. They're flagged `degraded: true`, and the UI shows this as an "engine-facts mode" note.
5. **Hybrid retrieval.** BM25 plus vector search with reciprocal rank fusion. With the offline embedder, this raised hit@4 from 77.5% to 85% on the eval set (see [../rag/chess-rag.md](../rag/chess-rag.md)). It also keeps retrieval reasonable if remote embeddings are unavailable.
6. **Evidence-only coaching.** The coach needs at least 3 analysed games. Every strength or weakness carries its metric and sample size, and the LLM narrative receives only the evidence report.

## Consequences

- AI quality with a real LLM depends on the chosen model. That quality, and retrieval with remote embeddings, are **not yet measured**. Run `npm run rag:eval` and review answers after configuring a provider.
- The guard can reject correct answers that quote a number differently, for example "0.7" when the fact is "+0.70". The allowed set includes 1- and 2-decimal and signed variants. Anything else falls back, which is safe.
