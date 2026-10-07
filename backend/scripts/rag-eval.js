// Retrieval evaluation (spec §57) against ai/evaluation/chess-rag-eval.json.
// Reports hit@1, hit@k (expected source among the top k chunks), MRR,
// concept coverage of the retrieved text, and latency.
// Usage: npm run rag:eval [-- --k 4 --verbose]
import fs from "fs";
import path from "path";
import { REPO_ROOT } from "../src/modules/ai/rag/corpus.js";
import { ensureKnowledgeIndex } from "../src/modules/ai/rag/ingest.js";
import { retrieveKnowledge } from "../src/modules/ai/rag/retrieve.js";
import { runScript } from "./_bootstrap.js";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};

runScript("rag:eval", async () => {
  const k = Number(arg("k", 4));
  const verbose = process.argv.includes("--verbose");
  const dataset = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "ai", "evaluation", "chess-rag-eval.json"), "utf8"));
  await ensureKnowledgeIndex();

  let hit1 = 0, hitK = 0, rr = 0, conceptHits = 0, conceptTotal = 0;
  const latencies = [];
  const misses = [];
  for (const item of dataset) {
    const t0 = performance.now();
    const { chunks } = await retrieveKnowledge(item.question, { limit: k });
    latencies.push(performance.now() - t0);
    const rank = chunks.findIndex((c) => c.source === item.expectedSource);
    if (rank === 0) hit1++;
    if (rank >= 0) { hitK++; rr += 1 / (rank + 1); } else misses.push({ question: item.question, expected: item.expectedSource, got: chunks.map((c) => c.source) });
    const text = chunks.map((c) => c.text.toLowerCase()).join(" ");
    for (const concept of item.expectedConcepts) { conceptTotal++; if (text.includes(concept.toLowerCase())) conceptHits++; }
  }
  const n = dataset.length;
  const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;
  latencies.sort((a, b) => a - b);
  console.log(`Questions: ${n}  k=${k}`);
  console.log(`hit@1  ${pct(hit1)}`);
  console.log(`hit@${k}  ${pct(hitK)}`);
  console.log(`MRR    ${(rr / n).toFixed(3)}`);
  console.log(`Concept coverage ${((conceptHits / conceptTotal) * 100).toFixed(1)}%`);
  console.log(`Latency p50 ${latencies[Math.floor(n / 2)].toFixed(1)}ms  p95 ${latencies[Math.floor(n * 0.95)].toFixed(1)}ms`);
  if (verbose || misses.length <= 10) for (const m of misses) console.log(`MISS  "${m.question}"  expected ${m.expected}  got ${m.got.join(", ")}`);
});
