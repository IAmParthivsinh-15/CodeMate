// Offline embedding: signed feature hashing of normalised words, word bigrams
// and character trigrams into a fixed-size vector. It is lexical, not truly
// semantic, so a chess synonym table maps everyday phrasing onto corpus terms
// ("horse" → knight, "castle" → castling). Deterministic, so it's also used in tests.

export const LOCAL_DIM = 1024;
export const LOCAL_MODEL_ID = "local-hash-v1";

const STOPWORDS = new Set(
  "a an and are as at be but by can do does for from how i if in into is it its me my of on or should so that the their them then there these this to was what when where which who why will with you your yourself about just than too very".split(" ")
);

// Multi-word phrases first, then single words.
const PHRASES = [
  [/check ?mate/g, "checkmate"],
  [/first (few )?moves|start of the game|beginning of the game/g, "opening"],
  [/end ?game|end of the game/g, "endgame"],
  [/middle ?game/g, "middlegame"],
  [/en passant|en-passant/g, "enpassant"],
  [/o-o-o|o-o|0-0-0|0-0/g, "castling"],
  [/can'?t move|cannot move|stuck in front of (my|the) king/g, "pin"],
  [/two pieces at once|attack two|attacks two|double attack/g, "fork"],
  [/wrong (colou?red )?bishop/g, "wrong bishop"],
  [/king and pawn/g, "king pawn"],
  [/rook and pawn/g, "rook pawn endgame"],
  [/building a bridge|bridge building/g, "lucena"],
  [/in between move|intermediate move/g, "zwischenzug"],
  [/free piece|undefended piece|loose piece|left my (queen|rook|bishop|knight) hanging/g, "hanging"],
  [/no legal moves?/g, "stalemate"],
  [/first rank|last rank|back row|behind (my|his|her|their) own pawns/g, "back rank"],
  [/runaway pawn|catch (a|the) pawn|stop (a|the) pawn from queening/g, "rule of the square"],
  [/chased away|kicked away|can'?t be attacked by (enemy )?pawns/g, "outpost"],
  [/checks,? captures,? (and )?threats/g, "calculation candidate moves checks captures threats"],
  [/(piece|pawn|exchange) up|ahead in material|up material/g, "material advantage trade"],
  [/check first|in-between|before recapturing/g, "zwischenzug"],
];
const SYNONYMS = {
  horse: "knight", horsey: "knight", castle: "castling", castled: "castling", castles: "castling",
  take: "capture", takes: "capture", took: "capture", trade: "exchange", trades: "exchange", trading: "exchange",
  swap: "exchange", mate: "checkmate", mated: "checkmate", tempo: "tempi", pawns: "pawn", clock: "time",
  blunder: "mistake", blundered: "mistake", sac: "sacrifice", promote: "promotion", queening: "promotion",
  forking: "fork", forked: "fork", pinned: "pin", pinning: "pin", skewered: "skewer", overloaded: "overload",
  opposition: "opposition", passer: "passed", zugzwang: "zugzwang",
};

// Light stemming: enough to merge "attacks/attacking/attacked".
function stem(w) {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function tokenize(text) {
  let t = text.toLowerCase();
  for (const [re, rep] of PHRASES) t = t.replace(re, ` ${rep} `);
  return t
    .replace(/[^a-z0-9+#=\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map((w) => SYNONYMS[w] || w)
    .flatMap((w) => w.split(" "))
    .map(stem);
}

// FNV-1a 32-bit
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function embedLocal(text, dim = LOCAL_DIM) {
  const v = new Float32Array(dim);
  const tokens = tokenize(text);
  const counts = new Map();
  const add = (feature, weight) => counts.set(feature, (counts.get(feature) || 0) + weight);
  tokens.forEach((w, i) => {
    add(`w:${w}`, 1);
    if (i + 1 < tokens.length) add(`b:${w}_${tokens[i + 1]}`, 0.7);
    const padded = `^${w}$`;
    for (let j = 0; j + 3 <= padded.length; j++) add(`c:${padded.slice(j, j + 3)}`, 0.25);
  });
  for (const [feature, tf] of counts) {
    const h = hash(feature);
    const sign = h & 1 ? 1 : -1;
    v[(h >>> 1) % dim] += sign * (1 + Math.log(tf));
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(v, (x) => x / norm);
}
