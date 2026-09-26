# ADR 0001: Organise the backend as a modular monolith

- **Status:** Accepted
- **Date:** 2026-09-26
- **Spec reference:** ENHANCEMENT.md §4 (architectural evolution), §6 (repository target structure), §60 (don't overengineer)

## Context

The backend used a flat, layer-based layout (`controller/`, `model/`, `routes/`, `services/`, `utills/`). Each feature was spread across four folders, and nothing marked which code belongs to which future service boundary.

The spec says to evolve through a **modular monolith** before extracting any microservices, and gives a target layout in §6.

## Decision

1. Backend code lives in `backend/src/` and is grouped **by feature**, not by layer:

   ```text
   src/
   ├── server.js              # process entry: env, DB connect, listen
   ├── routes/index.js        # mounts every module router at its public URL prefix
   ├── middleware/            # cross-cutting HTTP middleware (auth, roles)
   ├── modules/<feature>/     # <name>.routes.js, <name>.controller.js, <name>.model.js
   └── infrastructure/<tech>/ # adapters for external systems: mongodb, stockfish, judge0, llm
   ```

2. File names use a role suffix: `game.routes.js`, `game.controller.js`, `gameSession.model.js`.
3. Inside a module, imports are relative (`./`). A module may import another module's **model**, but not its controller. Code needed by several modules goes in `infrastructure/`, `middleware/`, or later `shared/`.
4. **Public URLs don't change** because of a file move. `routes/index.js` keeps the original prefixes (`/api/game`, `/api/game-analysis`, …).
5. Infrastructure used by more than the backend lives at the repo root in `infrastructure/`. Kubernetes manifests moved from `backend/k8s/` to `infrastructure/kubernetes/`.
6. A folder is only created once it has real content. Empty placeholders such as `modules/matchmaking/`, `sockets/`, `ai/` and `workers/` are added in the phase that first needs them.
7. The language stays JavaScript (ES modules). Spec §6 says not to migrate languages just for the sake of it.

### Module map

| Module | Contents | Likely future service (spec §50) |
| :-- | :-- | :-- |
| `auth` | register, login, tokens | auth-service |
| `users` | `User` model | user-service |
| `admin` | admin login, admin management | auth-service |
| `games` | game sessions, bot move | game-service |
| `chess` | engine endpoints | game-service / analysis-service |
| `analysis` | Stockfish + AI game analysis | analysis-service |
| `coding` | problems, code execution | coding-service |

## Consequences

- **Good:** each feature is in one folder; future service boundaries are visible; new modules (`matchmaking`, `ai`) have an obvious home.
- **Good:** `git mv` kept file history (`git log --follow`).
- **Watch out:** the Stockfish binary is still found through `process.cwd()/engine`, so the server must be started from `backend/`. `npm start` and `npm run dev` already do this. Phase 0 adds a `STOCKFISH_PATH` override.
- **Watch out:** anything that referred to the old paths directly (the `backend/k8s/` path in docs, `node server.js`) must use the new ones. Both READMEs were updated.
