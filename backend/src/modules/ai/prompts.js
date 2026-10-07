import fs from "fs";
import path from "path";
import { PROMPTS_DIR } from "./rag/corpus.js";

// Prompts are Markdown templates in ai/prompts/ (spec §58), not strings in
// controllers. {{name}} placeholders are filled by render().
const cache = new Map();

export function loadPrompt(name) {
  if (!cache.has(name)) cache.set(name, fs.readFileSync(path.join(PROMPTS_DIR, `${name}.md`), "utf8"));
  return cache.get(name);
}

export function render(name, vars = {}) {
  const all = { grounding: loadPrompt("grounding-rules"), ...vars };
  return loadPrompt(name).replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = all[k];
    if (v == null || v === "") return "(none)";
    return typeof v === "string" ? v : JSON.stringify(v, null, 1);
  });
}
