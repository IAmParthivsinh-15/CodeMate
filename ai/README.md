# CodeMate AI

This folder holds the **content** of CodeMate's AI platform: the chess knowledge corpus, prompt templates, and the retrieval evaluation set. The **code** lives in the backend (`backend/src/modules/ai/` and `backend/src/infrastructure/{llm,embeddings,vector}/`), so it can share models and configuration. See [ADR 0003](../docs/decisions/0003-service-extraction-by-role.md).

```text
ai/
├── corpus/chess-knowledge/   # 47 Markdown documents, 6 topics (the Chess Knowledge RAG source)
├── prompts/                  # LLM prompt templates with {{placeholders}}
└── evaluation/               # chess-rag-eval.json: 40 retrieval test questions
```

## The two RAG systems

| | Game Analysis RAG | Chess Knowledge RAG |
| :-- | :-- | :-- |
| Question | "Why was move 23 a mistake?" | "What is a pin?" |
| Endpoint | `POST /api/games/:id/chat`, `/moves/:ply/explain` | `POST /api/chess/chat` |
| Retrieval | Structured: selected moves from the stored Stockfish analysis, plus theme-mapped corpus sections | Hybrid BM25 + vector search over the corpus |
| Docs | [docs/rag/game-rag.md](../docs/rag/game-rag.md) | [docs/rag/chess-rag.md](../docs/rag/chess-rag.md) |

An intent router sends mixed questions ("Did I miss a fork in this game?") to both. It never forces every question through both.

## LLM gateway

Business code calls `llm.generate({ task, system, messages, json, schema })`. The provider comes from `LLM_PROVIDER` (`none` | `groq` | `nvidia` | `gemini`), and the model from the task's tier:

| Task | Tier | Env override |
| :-- | :-- | :-- |
| `chess_chat` | small | `LLM_MODEL_SMALL` |
| `game_chat`, `explain_move`, `analysis_summary` | medium | `LLM_MODEL_MEDIUM` |
| `coach` | large | `LLM_MODEL_LARGE` |

`LLM_MODEL` sets a default for all tiers. Built-in model names are only defaults, so check your provider's catalogue. JSON output is validated with zod and retried once on bad JSON. **Every AI feature has a deterministic, engine-grounded fallback**, so CodeMate is fully usable with `LLM_PROVIDER=none`.

## Prompts

| File | Used by |
| :-- | :-- |
| `grounding-rules.md` | Included in every prompt (spec §25: facts vs knowledge vs explanation vs inference) |
| `game-chat.md` | Game Analysis RAG conversation |
| `explain-move.md` | "Explain with AI" (five-part structure, spec §15) |
| `chess-chat.md` | Chess Knowledge RAG |
| `game-analysis.md` | Post-game AI report (ai-worker) |
| `coach.md` | AI coach summary and chat (evidence report only) |

Edit prompts here; there's no need to touch code. Placeholders missing a value render as `(none)`.

## Working on the corpus

1. Add or edit `corpus/chess-knowledge/<topic>/<subcategory>.md`. Frontmatter needs `title`, `topic` (= folder), `subcategory` (= filename), `difficulty`, `tags`. Use 3–6 `##` sections that each make sense on their own.
2. `cd backend && npm run ingest`. Only changed chunks are re-embedded.
3. `npm run rag:eval` checks retrieval didn't get worse. Add an eval question for new topics.
4. If a new document should be pulled in by an analysis theme, map it in `backend/src/config/analysis.js` (`THEME_KNOWLEDGE`). A unit test checks every mapped document exists.

Only use material you wrote or are licensed to use (spec §18).
