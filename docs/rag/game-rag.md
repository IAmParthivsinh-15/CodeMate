# Game Analysis RAG

> Answers "talk to me about THIS game" (spec §13). Endpoints: `POST /api/games/:id/chat` (conversation) and `POST /api/games/:id/moves/:ply/explain` (Explain with AI). Code: `backend/src/modules/ai/{intentRouter,gameContext,grounding,ai.service}.js`.

Most of this "retrieval" is **structured database lookup, not vectors** (spec §60.6). The relevant facts are specific moves of a specific game, which a query over the stored analysis finds exactly.

## Sources combined (spec §13 A–E)

| Source | Where it comes from |
| :-- | :-- |
| A. Game metadata | `GameSession`: mode, players, result and reason, opening, date, time control |
| B. Move history | Compact SAN move list (truncated at 1200 characters) |
| C. Stockfish analysis | `GameAnalysis.moveAnalysis` for the selected moves only |
| D. Chess knowledge | Corpus documents mapped from the moves' themes (`THEME_KNOWLEDGE` in `config/analysis.js`), plus hybrid chess RAG when the question is mixed |
| E. Player history | Recurring themes across the player's last 10 other analysed games, when the question asks ("again", "same mistake", "always"…) |

## Flow

```text
question (+ selectedPly from the board)
  → intent router: game | chess | mixed          (rules; "What is a pin?" asked on the game page → chess only)
  → identify game (URL) + ownership check
  → select relevant moves (max 6):
      explicit move numbers ("move 23", "23...") · SAN mentioned ("Nxe5") · selected ply ·
      "where did I lose…" → largest drop in winning chances · "mistake/blunder" → worst by CPL ·
      "tactic/missed" → tactical themes · "king/mate" → king-safety themes · opening/endgame phase ·
      default → the player's 3 biggest mistakes
  → format them as ENGINE FACTS (evals formatted White-POV: "+1.35", "M3")
  → optional player history
  → knowledge: theme docs (+ general chess RAG if mixed)
  → prompt (ai/prompts/game-chat.md), medium tier, JSON validated by zod
  → grounding check → answer + facts + sources
```

## Grounding (spec §25)

- The prompt ([grounding-rules.md](../../ai/prompts/grounding-rules.md)) separates Stockfish facts, chess knowledge, explanation and inference, and requires "Stockfish evaluated…" wording.
- After generation, `checkGrounding()` extracts every evaluation-looking token (`+1.35`, `-0.4`, `M3`) and compares it with the facts. **If any is unknown, the LLM answer is discarded** and the deterministic answer is returned instead, with `degraded: true` and `groundingWarnings` listing the invented numbers. This is covered by an integration test that uses a fake provider inventing `+4.20`.
- The response always includes `facts` (the exact engine data used), so the UI can show "Stockfish facts" next to the explanation.

## Explain this move (spec §15)

`POST /api/games/:id/moves/:ply/explain` returns `{ whatHappened, whyItMatters, betterMove, concept, lookFor }`. `lookFor` comes preferably from the theme document's "What to look for next time" section. The response also has `canPractice`, which the UI turns into the **[Practice this position]** button (`POST /api/games/:id/mistakes/:ply/practice` creates the puzzle). Results are cached for an hour per (game, ply, analysis version, provider).

## Deterministic fallback

With `LLM_PROVIDER=none`, or when a call fails or isn't grounded, answers are composed from the facts:

> **Move 3 (Black): Nf6** was a blunder. Stockfish evaluated the position at -0.38 before and M1 after (White's view)… Stockfish preferred **g6**…

This is a useful, grounded answer, not an error message. The UI marks it as engine-facts mode.

## Post-game AI report

When `analysis.completed` arrives, the `ai-worker` writes `GameAnalysis.aiReport` (`summary`, `strengths`, `weaknesses`, `keyMoments`, `trainingRecommendations`) from the side statistics and the three biggest mistakes, using the same grounding check and fallback.

## Themes (deterministic, not LLM)

`hanging_piece`, `missed_tactic`, `fork`, `missed_fork`, `allowed_mate`, `missed_mate`, `king_safety`, `endgame_technique`, `opening_principles`, `time_management`. They are derived from engine best moves and replies plus board geometry (`analysis.service.js#detectThemes`), and only attached when centipawn loss ≥ 100 (mate themes always). When the reply is an immediate mate, only the mate and king-safety themes apply.
