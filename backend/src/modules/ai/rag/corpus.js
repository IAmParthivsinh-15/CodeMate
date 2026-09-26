import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Chess Knowledge corpus lives at <repo>/ai/corpus/chess-knowledge (spec §18).
const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "../../../../..");
export const CORPUS_DIR = process.env.CHESS_CORPUS_DIR || path.join(REPO_ROOT, "ai", "corpus", "chess-knowledge");
export const PROMPTS_DIR = path.join(REPO_ROOT, "ai", "prompts");

// Tiny frontmatter parser for the fields the corpus uses (strings and [a, b] lists).
export function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    meta[key] = value.startsWith("[")
      ? value.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
      : value.trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body: raw.slice(m[0].length) };
}

export function loadCorpus(dir = CORPUS_DIR) {
  if (!fs.existsSync(dir)) return [];
  const docs = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) {
        const source = path.relative(dir, p).split(path.sep).join("/");
        const { meta, body } = parseFrontmatter(fs.readFileSync(p, "utf8"));
        docs.push({
          documentId: source.replace(/\.md$/, ""),
          source,
          title: meta.title || path.basename(p, ".md"),
          topic: meta.topic || source.split("/")[0],
          subcategory: meta.subcategory || path.basename(p, ".md"),
          difficulty: meta.difficulty || "beginner",
          tags: meta.tags || [],
          body,
        });
      }
    }
  };
  walk(dir);
  return docs.sort((a, b) => a.source.localeCompare(b.source));
}

// Text cleaning: normalise whitespace, drop the document's H1 (the title is
// added to every chunk explicitly).
export const cleanText = (s) => s.replace(/\r\n/g, "\n").replace(/^# .*$/m, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Split on "## " headings; long sections are split by paragraph with one
 * paragraph of overlap. Each chunk carries enrichment metadata (spec §19).
 */
export function chunkDocument(doc, { maxChars = 1200 } = {}) {
  const text = cleanText(doc.body);
  const sections = [];
  let current = { heading: "Overview", lines: [] };
  for (const line of text.split("\n")) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      if (current.lines.join("").trim()) sections.push(current);
      current = { heading: h[1].trim(), lines: [] };
    } else current.lines.push(line);
  }
  if (current.lines.join("").trim()) sections.push(current);

  const chunks = [];
  for (const s of sections) {
    const paragraphs = s.lines.join("\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const groups = [];
    let group = [];
    for (const p of paragraphs) {
      if (group.length && [...group, p].join("\n\n").length > maxChars) {
        groups.push(group);
        group = [group.at(-1)]; // overlap
      }
      group.push(p);
    }
    if (group.length) groups.push(group);
    groups.forEach((g, i) => {
      chunks.push({
        chunkId: `${doc.documentId}#${slug(s.heading)}${groups.length > 1 ? `-${i + 1}` : ""}`,
        documentId: doc.documentId,
        source: doc.source,
        title: doc.title,
        topic: doc.topic,
        subcategory: doc.subcategory,
        difficulty: doc.difficulty,
        tags: doc.tags,
        section: s.heading,
        text: `${doc.title} — ${s.heading}\n\n${g.join("\n\n")}`,
      });
    });
  }
  return chunks;
}
