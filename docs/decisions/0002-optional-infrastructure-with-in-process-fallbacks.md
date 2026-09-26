# ADR 0002: Optional infrastructure with in-process fallbacks

- **Status:** Accepted
- **Date:** 2026-09-26
- **Spec reference:** §2 (every technology must solve a real problem), §7 (a developer must be able to `npm install && npm run dev`), §61

## Context

The target architecture uses Redis, Kafka, Qdrant, an LLM provider and Judge0. Requiring all five before anyone can start the app would break the Phase 0 goal of a clean local start, and would make tests depend on external services.

## Decision

Each piece of infrastructure sits behind a small adapter with two implementations, chosen by configuration:

| Concern | Configured | Fallback when empty |
| :-- | :-- | :-- |
| KV / live state (`REDIS_URL`) | Redis via ioredis | `MemoryStore`: the same command subset, in-process |
| Events (`KAFKA_BROKERS`) | Kafka via kafkajs | `MemoryBus`: async delivery, one delivery per consumer group, retries |
| Vectors (`VECTOR_DB_URL`) | Qdrant REST | In-memory cosine index rebuilt from the MongoDB manifest |
| LLM (`LLM_PROVIDER`) | Groq / NVIDIA / Gemini | Deterministic, engine-grounded answers (`degraded: true`) |
| Embeddings (`EMBEDDING_PROVIDER`) | Gemini / NVIDIA | Local feature-hashing embedder |
| Code execution (`JUDGE0_API_URL`) | Judge0 | **No fallback**: submissions return 503. User code never runs locally. |

`GET /ready` reports which backend is active (`backends: { kv, events, vector, llm }`).

## Consequences

- **Good:** a fresh clone runs with MongoDB only. The 67 backend tests run the whole system in-process, including workers, sockets and Stockfish.
- **Good:** production behaviour is the same code path. Only the adapter differs.
- **Watch out:** the fallbacks are single-process. More than one API or realtime instance **requires** Redis, because rate limits, presence, matchmaking and Socket.IO rooms must be shared. Separate worker processes **require** Kafka, since the in-process bus doesn't cross processes. `docker-compose.yml` and the Kubernetes manifests configure both.
- **Watch out:** the Redis, Kafka and Qdrant adapters are covered by code review and the in-process contract tests, not by tests against real servers, because no Docker daemon was available when this was built. Run `docker compose up` to exercise them.
