// Question → which RAG system(s) to use (spec §22). Rules, not an LLM:
// this runs on every question and must be cheap and predictable.

const GAME_SIGNALS = [
  /\b(my|i|me|mine)\b/,
  /\bthis game\b/,
  /\bmove\s*\d+\b/,
  /\b\d+\s*\.{1,3}\s*[a-hkqrbnox]/i,
  /\b(did i|should i have|could i have|why did|where did|when did)\b/,
  /\b(opponent|lost|won|resigned|blunder(ed)?|mistake|inaccuracy|missed)\b/,
];

// A piece move or capture in SAN (Nxe5, exd5, Qh4+, O-O), matched
// case-sensitively on the raw question. Bare squares ("e4") are not enough:
// "what is the e4 opening" is a knowledge question.
const SAN_MOVE = /\b(?:[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8]|O-O(?:-O)?)[+#]?/;

const KNOWLEDGE_SIGNALS = [
  /\b(what is|what's|what are|explain|define|definition|meaning|how do(es)?|how to|when should|teach me|tell me about|principles?|concept|idea behind|rule)\b/,
  /\b(pin|fork|skewer|discovered attack|zugzwang|opposition|lucena|philidor|outpost|isolated pawn|passed pawn|zwischenzug|deflection|decoy|overload|en passant|castling|fianchetto|gambit|bishop pair|open file|weak square|prophylaxis)\b/,
];

const any = (res, text) => res.some((re) => re.test(text));

/**
 * @param {string} question
 * @param {{hasGame:boolean}} ctx
 * @returns {"game"|"chess"|"mixed"}
 */
export function routeQuestion(question, { hasGame }) {
  if (!hasGame) return "chess";
  const text = question.toLowerCase();
  const game = any(GAME_SIGNALS, text) || SAN_MOVE.test(question);
  const knowledge = any(KNOWLEDGE_SIGNALS, text);
  if (game && knowledge) return "mixed";
  if (knowledge) return "chess";
  return "game"; // default inside a game chat: talk about the game
}

// "Did I repeat the same mistake?" needs the player's other games (spec §13 E).
export const wantsHistory = (question) =>
  /\b(again|repeat(ed)?|same mistake|always|usually|keep (making|doing)|pattern|recurring|other games|habit)\b/i.test(question);
