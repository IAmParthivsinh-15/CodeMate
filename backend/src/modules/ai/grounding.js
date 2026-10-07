import { z } from "zod";
import { MATE_CP } from "../../infrastructure/stockfish/uci.js";

// Structured AI outputs (spec §59). Validated before anything is stored or returned.
const concepts = z.array(z.string().trim().toLowerCase().max(60)).max(6).default([]);
const recs = z.array(z.string().trim().max(240)).max(5).default([]);

export const chatAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(4000),
  keyConcepts: concepts,
  recommendations: recs,
});

export const explainSchema = z.object({
  whatHappened: z.string().trim().min(1).max(800),
  whyItMatters: z.string().trim().min(1).max(800),
  betterMove: z.string().trim().min(1).max(800),
  concept: z.string().trim().min(1).max(800),
  lookFor: z.string().trim().min(1).max(600),
  keyConcepts: concepts,
});

export const reportSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  strengths: z.array(z.string().trim().max(300)).max(4).default([]),
  weaknesses: z.array(z.string().trim().max(300)).max(4).default([]),
  keyMoments: z.array(z.object({ ply: z.coerce.number().int(), explanation: z.string().trim().max(600) })).max(6).default([]),
  trainingRecommendations: z.array(z.string().trim().max(300)).max(4).default([]),
});

// Evaluation display, White's point of view: "+1.35", "-0.40", "M3", "-M2", "#".
export function formatEval(cp, mate) {
  if (mate != null) return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  if (cp == null) return "?";
  if (Math.abs(cp) >= MATE_CP) return "#";
  const p = (cp / 100).toFixed(2);
  return cp > 0 ? `+${p}` : p;
}

/**
 * Spec §25: the LLM must not invent evaluations. Collect every
 * evaluation-looking token in the answer (signed decimals like +1.35 / -0.4,
 * mate scores like M3) and report the ones that don't appear in the facts.
 */
export function checkGrounding(answer, allowedEvals) {
  const allowed = new Set();
  for (const e of allowedEvals) {
    allowed.add(e);
    const n = Number(e);
    if (!Number.isNaN(n)) {
      allowed.add(n.toFixed(2)); allowed.add(n.toFixed(1)); allowed.add((-n).toFixed(2)); allowed.add((-n).toFixed(1));
      allowed.add(`+${Math.abs(n).toFixed(2)}`); allowed.add(`+${Math.abs(n).toFixed(1)}`);
      allowed.add(`-${Math.abs(n).toFixed(2)}`); allowed.add(`-${Math.abs(n).toFixed(1)}`);
    } else if (/^-?M\d+$/.test(e)) {
      allowed.add(e.replace("-", ""));
    }
  }
  const found = answer.match(/(?<![\w.])[+-]\d{1,2}\.\d{1,2}(?!\d)|(?<![\w])-?M\d{1,2}\b/g) || [];
  const unknown = [...new Set(found.filter((t) => !allowed.has(t) && !allowed.has(t.replace(/^\+/, ""))))];
  return { grounded: unknown.length === 0, unknownNumbers: unknown };
}
