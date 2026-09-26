# ADR 0003: Extract services as deployment roles of one codebase

- **Status:** Accepted
- **Date:** 2026-09-26
- **Spec reference:** §4 (evolve gradually), §6 (target repository structure), §15 / §50 (microservice extraction), §60.2 (don't create microservices prematurely)

## Context

Phase 15 asks for service extraction, but spec §50 warns against services that don't benefit from independent scaling, deployment or ownership. CodeMate has one team, one database, and three workloads with genuinely different scaling profiles:

- request-driven REST,
- connection-driven WebSockets,
- CPU-bound Stockfish and I/O-bound Judge0 background work.

Spec §6 also sketches top-level `workers/` and `ai/` folders as if they were separate packages.

## Decision

1. **One backend package, several process roles** chosen by `SERVICE_ROLE` (`all | api | realtime | worker`, with `WORKERS=analysis,ai,coding,analytics`). One image, one Deployment per role.
2. Worker **code** stays in `backend/src/workers/`, and AI/RAG code in `backend/src/modules/ai/`, next to the models they use. There's no top-level `workers/` package, because it would need its own copy of every model and a shared-library build step without any gain.
3. The top-level `ai/` folder holds **content** only: corpus, prompts and the eval set. It's what non-engineers edit, and it's mounted into the image.
4. Module boundaries (service functions, event contracts, id-only payloads) are kept strict, so a module can later move to its own repository by swapping in-process calls for HTTP at those seams.

## Consequences

- **Good:** independent scaling where it matters: realtime pods on connections, analysis workers on Kafka lag (HPA bounded by partitions), the API on CPU.
- **Good:** no distributed transactions and no duplicated models. `docker compose up` shows the multi-service topology.
- **Trade-off:** all roles deploy together, from one image and version. Acceptable for one team. Revisit if a module gets its own owner or release cadence.
