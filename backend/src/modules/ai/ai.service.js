import { createHash } from "crypto";
import ChatThread from "./chatThread.model.js";
import GameAnalysis from "../analysis/gameAnalysis.model.js";
import GameSession from "../games/gameSession.model.js";
import { userColors } from "../analysis/analysis.service.js";
import { llm } from "../../infrastructure/llm/index.js";
import { kvJson } from "../../infrastructure/redis/index.js";
import { publish } from "../../infrastructure/kafka/index.js";
import { TOPICS } from "../../shared/events.js";
import { childLogger } from "../../infrastructure/logger/index.js";
import { retrieveKnowledge, retrieveFromSources, sourcesOf } from "./rag/retrieve.js";
import { routeQuestion, wantsHistory } from "./intentRouter.js";
import { selectRelevantMoves, factsFor, factsText, allowedEvalsOf, gameMetaText, playerHistory } from "./gameContext.js";
import { chatAnswerSchema, explainSchema, reportSchema, checkGrounding, formatEval } from "./grounding.js";
import { render } from "./prompts.js";
import { THEME_KNOWLEDGE, THEME_LABELS, SIGNIFICANT } from "../../config/analysis.js";
import { conflict, notFound } from "../../shared/errors.js";

const log = childLogger("ai");
const HISTORY_TURNS = 6;
const CACHE_TTL_SEC = 3600;

const levelOf = (rating = 800) => (rating < 1200 ? "a beginner" : rating < 1800 ? "an intermediate player" : "an advanced player");
const knowledgeText = (chunks) =>
  chunks.length ? chunks.map((c) => `[${c.title} / ${c.section}]\n${c.text}`).join("\n\n---\n\n") : "(none)";
const hashKey = (...parts) => createHash("sha256").update(parts.map(String).join("|")).digest("hex").slice(0, 32);
const firstParagraphs = (text, n = 2) => text.split("\n\n").slice(1, 1 + n).join("\n\n"); // skip "Title — Section" line

// Themes → corpus documents; phase documents when no theme applies.
function knowledgeSourcesFor(moves) {
  const out = [];
  for (const m of moves) {
    for (const t of m.themes || []) for (const s of THEME_KNOWLEDGE[t] || []) if (!out.includes(s)) out.push(s);
  }
  if (!out.length && moves.length) {
    const phase = moves[0].phase;
    out.push(phase === "opening" ? "openings/opening_principles.md" : phase === "endgame" ? "endgames/endgame_principles.md" : "middlegame/calculation.md");
  }
  return out;
}

async function threadFor(userId, scope, gameId = null) {
  return ChatThread.findOneAndUpdate(
    { user: userId, scope, game: gameId },
    { $setOnInsert: { user: userId, scope, game: gameId, messages: [] } },
    { upsert: true, new: true }
  );
}

async function appendToThread(thread, userMsg, assistantMsg) {
  await ChatThread.updateOne({ _id: thread._id }, { $push: { messages: { $each: [userMsg, assistantMsg], $slice: -100 } } });
  publish(TOPICS.AI_CHAT_COMPLETED, "ai.chat.completed", {
    userId: String(thread.user), scope: thread.scope, gameId: thread.game ? String(thread.game) : null,
    concepts: assistantMsg.keyConcepts || [], degraded: !!assistantMsg.degraded,
  });
}

const historyMessages = (thread) =>
  (thread.messages || []).slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.content }));

// Run an LLM task; on any failure return null so the caller uses its fallback.
async function tryLlm(req) {
  if (!llm.enabled) return null;
  try {
    return await llm.generate(req);
  } catch (err) {
    log.warn({ err: err.message, task: req.task }, "LLM unavailable, using deterministic fallback");
    return null;
  }
}

// ------------------------------------------------------------ chess chat ---

function chessFallback(question, chunks) {
  if (!chunks.length) {
    return { answer: "I couldn't find that topic in the CodeMate chess guide. Try asking about a tactic, an opening, a strategic idea or an endgame by name.", keyConcepts: [], recommendations: [] };
  }
  const [top, ...rest] = chunks;
  const related = [...new Set(rest.map((c) => c.title).filter((t) => t !== top.title))].slice(0, 2);
  return {
    answer: `**${top.title}: ${top.section}**\n\n${firstParagraphs(top.text, 3)}${related.length ? `\n\nRelated: ${related.join(", ")}.` : ""}`,
    keyConcepts: [top.subcategory.replace(/_/g, " ")],
    recommendations: related.map((t) => `Read about ${t}`),
  };
}

/** General Chess Knowledge RAG (spec §17), POST /api/chess/chat */
export async function chessChat(user, question, { threadScope = "chess", gameId = null } = {}) {
  const thread = await threadFor(user._id, threadScope, gameId);
  const firstTurn = !thread.messages.length;
  const level = levelOf(user.chessStats?.rating);
  const cacheKey = firstTurn ? `ai:response:chess:${hashKey(question.trim().toLowerCase(), level, llm.providerName)}` : null;
  let result = cacheKey ? await kvJson.get(cacheKey) : null;

  if (!result) {
    const { chunks, appliedTopic } = await retrieveKnowledge(question, { limit: 4 });
    const out = await tryLlm({
      task: "chess_chat",
      system: render("chess-chat", { knowledge: knowledgeText(chunks), level }),
      messages: [...historyMessages(thread), { role: "user", content: question }],
      json: true,
      schema: chatAnswerSchema,
    });
    const answer = out?.data || chessFallback(question, chunks);
    result = {
      ...answer,
      sources: sourcesOf(chunks),
      route: "chess",
      appliedTopic,
      provider: out?.provider || "none",
      model: out?.model || null,
      degraded: !out,
    };
    if (cacheKey && out) await kvJson.set(cacheKey, result, { ttlSec: CACHE_TTL_SEC });
  }

  await appendToThread(thread, { role: "user", content: question, route: "chess" }, { role: "assistant", content: result.answer, ...result });
  return result;
}

// ------------------------------------------------------------- game chat ---

function gameFallback(facts, knowledge, history, analysisReady) {
  if (!analysisReady) {
    return { answer: "This game hasn't been analysed by Stockfish yet, so I can't point to specific mistakes. Start the analysis from this page and ask again in a moment.", keyConcepts: [], recommendations: ["Run the Stockfish analysis"] };
  }
  if (!facts.length) {
    return { answer: "Stockfish didn't flag any significant mistakes on your side in this game. Nice work. Ask about a specific move number to see its evaluation.", keyConcepts: [], recommendations: [] };
  }
  const lines = facts.map((f) =>
    `- **Move ${f.moveNumber} (${f.color}): ${f.played}** was a ${f.classification}. Stockfish evaluated the position at ${f.evalBefore} before and ${f.evalAfter} after (White's view), a centipawn loss of ${f.centipawnLoss}. Stockfish preferred **${f.bestMove}**${f.line ? ` (line: ${f.line})` : ""}.${f.themes.length ? ` Theme: ${f.themes.join(", ")}.` : ""}`
  );
  const tip = knowledge[0] ? `\n\n**From the guide: ${knowledge[0].title} / ${knowledge[0].section}**\n${firstParagraphs(knowledge[0].text, 1)}` : "";
  const hist = history?.themes?.length ? `\n\n${history.text}` : "";
  const themes = [...new Set(facts.flatMap((f) => f.themes))];
  return { answer: `${lines.join("\n")}${tip}${hist}`, keyConcepts: themes.map((t) => t.toLowerCase()).slice(0, 4), recommendations: themes.slice(0, 2).map((t) => `Practise positions with the theme: ${t}`) };
}

/** Game Analysis RAG (spec §13-14), POST /api/games/:id/chat */
export async function gameChat(user, game, question, { selectedPly } = {}) {
  const route = routeQuestion(question, { hasGame: true });
  if (route === "chess") {
    // Pure knowledge question asked from the game page: answer from the chess
    // corpus only (spec §22: don't force every query through both systems).
    return { ...(await chessChat(user, question, { threadScope: "game", gameId: game._id })), route: "chess" };
  }

  const thread = await threadFor(user._id, "game", game._id);
  const analysis = await GameAnalysis.findOne({ gameSession: game._id }).lean();
  const ready = analysis?.status === "completed";
  const colors = game.mode === "online" ? [game.colorOf(user._id)] : userColors(game);
  const { moves } = ready ? selectRelevantMoves(question, analysis, colors, selectedPly) : { moves: [] };
  const facts = moves.map(factsFor);
  const history = wantsHistory(question) ? await playerHistory(user._id, game._id) : null;

  let knowledge = await retrieveFromSources(knowledgeSourcesFor(moves), question, { limit: 2 });
  if (route === "mixed") {
    const general = (await retrieveKnowledge(question, { limit: 3 })).chunks;
    knowledge = [...knowledge, ...general.filter((g) => !knowledge.some((k) => k.chunkId === g.chunkId))].slice(0, 4);
  }

  const out = await tryLlm({
    task: "game_chat",
    system: render("game-chat", {
      game: await gameMetaText(game, user._id),
      facts: ready ? factsText(facts) : "(this game has not been analysed yet)",
      history: history?.text || "",
      knowledge: knowledgeText(knowledge),
    }),
    messages: [...historyMessages(thread), { role: "user", content: selectedPly ? `${question}\n(Selected move: ply ${selectedPly})` : question }],
    json: true,
    schema: chatAnswerSchema,
  });

  let answer = out?.data || gameFallback(facts, knowledge, history, ready);
  let grounding = { grounded: true, unknownNumbers: [] };
  if (out) {
    grounding = checkGrounding(answer.answer, allowedEvalsOf(facts));
    if (!grounding.grounded) {
      // An invented evaluation is worse than a plainer answer (spec §25).
      log.warn({ unknown: grounding.unknownNumbers }, "Ungrounded numbers in LLM answer; using fallback");
      answer = gameFallback(facts, knowledge, history, ready);
    }
  }

  const result = {
    ...answer,
    sources: sourcesOf(knowledge),
    facts,
    route,
    history: history ? { games: history.games, themes: history.themes.slice(0, 5) } : null,
    provider: out && grounding.grounded ? out.provider : "none",
    model: out && grounding.grounded ? out.model : null,
    degraded: !out || !grounding.grounded,
    groundingWarnings: grounding.unknownNumbers,
  };
  await appendToThread(thread, { role: "user", content: question, ply: selectedPly, route }, { role: "assistant", content: result.answer, ...result });
  return result;
}

export async function getThread(userId, scope, gameId = null) {
  const t = await ChatThread.findOne({ user: userId, scope, game: gameId }).lean();
  return t?.messages || [];
}

export async function clearThread(userId, scope, gameId = null) {
  await ChatThread.deleteOne({ user: userId, scope, game: gameId });
}

// ---------------------------------------------------------- explain move ---

function explainFallback(f, knowledge) {
  const tip = knowledge.find((k) => /look for|spot|next time|takeaway/i.test(k.section)) || knowledge[0];
  return {
    whatHappened: `You played ${f.played}. Stockfish evaluated the position at ${f.evalBefore} before the move and ${f.evalAfter} after it (White's point of view).`,
    whyItMatters: `That is a centipawn loss of ${f.centipawnLoss}, which Stockfish classifies as ${/^[aeiou]/.test(f.classification) ? "an" : "a"} ${f.classification}.${f.themes.length ? ` Theme: ${f.themes.join(", ")}.` : ""}`,
    betterMove: f.bestMove ? `Stockfish preferred ${f.bestMove}${f.line ? `, continuing ${f.line}` : ""}.` : "Stockfish did not report an alternative.",
    concept: knowledge[0] ? `${knowledge[0].title}: ${firstParagraphs(knowledge[0].text, 1)}` : "Compare candidate moves before committing: checks, captures and threats first.",
    lookFor: tip ? firstParagraphs(tip.text, 1) : "Before each move, ask what your opponent's most forcing reply would be.",
    keyConcepts: f.themes.map((t) => t.toLowerCase()).slice(0, 3),
  };
}

/** "Explain with AI" (spec §15), POST /api/games/:id/moves/:ply/explain */
export async function explainMove(user, game, ply) {
  const analysis = await GameAnalysis.findOne({ gameSession: game._id }).lean();
  if (analysis?.status !== "completed") throw conflict("Analyze the game first", "NOT_ANALYZED");
  const m = analysis.moveAnalysis.find((x) => x.ply === ply);
  if (!m) throw notFound("Move");
  const f = factsFor({ ...m, why: "selected for explanation" });

  const cacheKey = `ai:response:explain:${hashKey(game._id, ply, analysis.updatedAt?.getTime?.() ?? analysis.updatedAt, llm.providerName)}`;
  const cached = await kvJson.get(cacheKey);
  if (cached) return cached;

  const knowledge = await retrieveFromSources(knowledgeSourcesFor([m]), `${m.classification} ${f.themes.join(" ")} what to look for`, { limit: 3 });
  const out = await tryLlm({
    task: "explain_move",
    system: render("explain-move", { game: await gameMetaText(game, user._id), facts: factsText([f]), knowledge: knowledgeText(knowledge), classification: m.classification }),
    messages: [{ role: "user", content: `Explain move ${f.moveNumber} (${f.color}) ${f.played}.` }],
    json: true,
    schema: explainSchema,
  });

  let explanation = out?.data;
  let degraded = !out;
  if (explanation) {
    const text = Object.values(explanation).filter((v) => typeof v === "string").join(" ");
    if (!checkGrounding(text, allowedEvalsOf([f])).grounded) { explanation = null; degraded = true; }
  }
  const result = {
    move: f,
    explanation: explanation || explainFallback(f, knowledge),
    sources: sourcesOf(knowledge),
    canPractice: SIGNIFICANT.has(m.classification) && !!m.bestMoveUci,
    provider: degraded ? "none" : out.provider,
    model: degraded ? null : out.model,
    degraded,
  };
  await kvJson.set(cacheKey, result, { ttlSec: CACHE_TTL_SEC });
  return result;
}

// ------------------------------------------------ post-analysis AI report ---

function reportFallback(game, analysis, colors, keyMoves) {
  const side = colors.length === 1 ? analysis[colors[0] === "w" ? "white" : "black"] : null;
  const counts = side?.counts || {};
  const themes = [...new Set(keyMoves.flatMap((m) => m.themes || []))];
  const strengths = [];
  if (side?.accuracy >= 85) strengths.push(`High overall accuracy (${side.accuracy}%).`);
  if ((counts.best || 0) + (counts.excellent || 0) >= 5) strengths.push(`${(counts.best || 0) + (counts.excellent || 0)} best or excellent moves.`);
  if (!counts.blunder) strengths.push("No blunders.");
  return {
    summary: side
      ? `Stockfish rated your play at ${side.accuracy}% accuracy with an average centipawn loss of ${side.averageCentipawnLoss}: ${counts.blunder || 0} blunder(s), ${counts.mistake || 0} mistake(s) and ${counts.inaccuracy || 0} inaccuracy(ies).`
      : `Analysis complete: ${analysis.moveAnalysis.length} moves evaluated by Stockfish.`,
    strengths,
    weaknesses: themes.slice(0, 3).map((t) => `${THEME_LABELS[t] || t} came up in your key mistakes.`),
    keyMoments: keyMoves.map((m) => ({
      ply: m.ply, moveNumber: m.moveNumber, playedMove: m.playedMove, bestMove: m.bestMove,
      explanation: `Stockfish evaluated ${m.playedMove} as a ${m.classification} (${formatEval(m.evaluationBefore, m.mateBefore)} → ${formatEval(m.evaluationAfter, m.mateAfter)}); it preferred ${m.bestMove}.`,
    })),
    trainingRecommendations: themes.slice(0, 3).map((t) => `Solve puzzles on: ${THEME_LABELS[t] || t}`),
  };
}

/** AI worker: coach report after analysis.completed (spec §28). */
export async function generateAnalysisReport(gameId) {
  const [game, analysis] = await Promise.all([GameSession.findById(gameId), GameAnalysis.findOne({ gameSession: gameId })]);
  if (!game || analysis?.status !== "completed") return null;
  if (analysis.aiStatus === "completed") return analysis.aiReport;
  const colors = game.mode === "online" ? ["w", "b"] : userColors(game);
  const keyMoves = [...analysis.moveAnalysis]
    .filter((m) => colors.includes(m.color) && SIGNIFICANT.has(m.classification))
    .sort((a, b) => b.centipawnLoss - a.centipawnLoss)
    .slice(0, 3)
    .sort((a, b) => a.ply - b.ply);
  const facts = keyMoves.map((m) => factsFor({ ...m, why: "key moment" }));
  const side = colors.length === 1 ? analysis[colors[0] === "w" ? "white" : "black"] : { white: analysis.white, black: analysis.black };

  const out = await tryLlm({
    task: "analysis_summary",
    system: render("game-analysis", { game: await gameMetaText(game, game.player), stats: side, facts: factsText(facts) }),
    messages: [{ role: "user", content: "Write the report." }],
    json: true,
    schema: reportSchema,
  });
  let report = out?.data;
  if (report && !checkGrounding(JSON.stringify(report), allowedEvalsOf(facts)).grounded) report = null;
  if (report) {
    report.keyMoments = report.keyMoments
      .map((k) => { const m = keyMoves.find((x) => x.ply === k.ply); return m ? { ...k, moveNumber: m.moveNumber, playedMove: m.playedMove, bestMove: m.bestMove } : null; })
      .filter(Boolean);
  }
  const final = {
    ...(report || reportFallback(game, analysis, colors, keyMoves)),
    provider: report ? out.provider : "none",
    model: report ? out.model : null,
    generatedAt: new Date(),
  };
  await GameAnalysis.updateOne({ _id: analysis._id }, { aiReport: final, aiStatus: "completed" });
  return final;
}
