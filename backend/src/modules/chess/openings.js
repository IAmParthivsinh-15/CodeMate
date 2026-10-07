// Small opening classifier: the longest matching SAN prefix wins. Covers the
// mainstream openings a club player meets; unknown lines fall back to the
// nearest shorter match. `corpus` links to ai/corpus/chess-knowledge/openings/.
const OPENINGS = [
  ["e4", "B00", "King's Pawn Opening"],
  ["e4 e5", "C20", "King's Pawn Game"],
  ["e4 e5 Nf3", "C40", "King's Knight Opening"],
  ["e4 e5 Nf3 Nc6", "C44", "King's Knight Opening: Normal Variation"],
  ["e4 e5 Nf3 Nc6 Bc4", "C50", "Italian Game", "italian_game"],
  ["e4 e5 Nf3 Nc6 Bc4 Bc5", "C50", "Italian Game: Giuoco Piano", "italian_game"],
  ["e4 e5 Nf3 Nc6 Bc4 Bc5 b4", "C51", "Italian Game: Evans Gambit", "italian_game"],
  ["e4 e5 Nf3 Nc6 Bc4 Nf6", "C55", "Italian Game: Two Knights Defense", "italian_game"],
  ["e4 e5 Nf3 Nc6 Bb5", "C60", "Ruy Lopez", "ruy_lopez"],
  ["e4 e5 Nf3 Nc6 Bb5 a6", "C70", "Ruy Lopez: Morphy Defense", "ruy_lopez"],
  ["e4 e5 Nf3 Nc6 Bb5 Nf6", "C65", "Ruy Lopez: Berlin Defense", "ruy_lopez"],
  ["e4 e5 Nf3 Nc6 d4", "C44", "Scotch Game"],
  ["e4 e5 Nf3 Nc6 d4 exd4 Nxd4", "C45", "Scotch Game"],
  ["e4 e5 Nf3 Nc6 Nc3", "C46", "Three Knights Opening"],
  ["e4 e5 Nf3 Nc6 Nc3 Nf6", "C47", "Four Knights Game"],
  ["e4 e5 Nf3 Nf6", "C42", "Petrov's Defense"],
  ["e4 e5 Nf3 d6", "C41", "Philidor Defense"],
  ["e4 e5 f4", "C30", "King's Gambit"],
  ["e4 e5 f4 exf4", "C33", "King's Gambit Accepted"],
  ["e4 e5 Nc3", "C25", "Vienna Game"],
  ["e4 e5 Bc4", "C23", "Bishop's Opening"],
  ["e4 e5 Qh5", "C20", "King's Pawn Game: Wayward Queen Attack"],
  ["e4 c5", "B20", "Sicilian Defense", "sicilian_defense"],
  ["e4 c5 Nf3", "B27", "Sicilian Defense", "sicilian_defense"],
  ["e4 c5 Nf3 d6", "B50", "Sicilian Defense", "sicilian_defense"],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", "B90", "Sicilian Defense: Najdorf Variation", "sicilian_defense"],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6", "B70", "Sicilian Defense: Dragon Variation", "sicilian_defense"],
  ["e4 c5 Nf3 Nc6", "B30", "Sicilian Defense: Old Sicilian", "sicilian_defense"],
  ["e4 c5 Nf3 e6", "B40", "Sicilian Defense: French Variation", "sicilian_defense"],
  ["e4 c5 c3", "B22", "Sicilian Defense: Alapin Variation", "sicilian_defense"],
  ["e4 c5 Nc3", "B23", "Sicilian Defense: Closed", "sicilian_defense"],
  ["e4 e6", "C00", "French Defense", "french_defense"],
  ["e4 e6 d4 d5", "C00", "French Defense", "french_defense"],
  ["e4 e6 d4 d5 Nc3", "C10", "French Defense: Paulsen Variation", "french_defense"],
  ["e4 e6 d4 d5 Nc3 Bb4", "C15", "French Defense: Winawer Variation", "french_defense"],
  ["e4 e6 d4 d5 Nd2", "C03", "French Defense: Tarrasch Variation", "french_defense"],
  ["e4 e6 d4 d5 e5", "C02", "French Defense: Advance Variation", "french_defense"],
  ["e4 e6 d4 d5 exd5", "C01", "French Defense: Exchange Variation", "french_defense"],
  ["e4 c6", "B10", "Caro-Kann Defense", "caro_kann_defense"],
  ["e4 c6 d4 d5", "B12", "Caro-Kann Defense", "caro_kann_defense"],
  ["e4 c6 d4 d5 e5", "B12", "Caro-Kann Defense: Advance Variation", "caro_kann_defense"],
  ["e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5", "B18", "Caro-Kann Defense: Classical Variation", "caro_kann_defense"],
  ["e4 d5", "B01", "Scandinavian Defense"],
  ["e4 Nf6", "B02", "Alekhine's Defense"],
  ["e4 d6", "B07", "Pirc Defense"],
  ["e4 g6", "B06", "Modern Defense"],
  ["d4", "A40", "Queen's Pawn Opening"],
  ["d4 d5", "D00", "Queen's Pawn Game"],
  ["d4 d5 Bf4", "D00", "London System (Accelerated)", "london_system"],
  ["d4 d5 Nf3 Nf6 Bf4", "D02", "London System", "london_system"],
  ["d4 Nf6 Nf3 g6 Bf4", "A48", "London System", "london_system"],
  ["d4 d5 c4", "D06", "Queen's Gambit", "queens_gambit"],
  ["d4 d5 c4 e6", "D30", "Queen's Gambit Declined", "queens_gambit"],
  ["d4 d5 c4 dxc4", "D20", "Queen's Gambit Accepted", "queens_gambit"],
  ["d4 d5 c4 c6", "D10", "Slav Defense", "queens_gambit"],
  ["d4 Nf6", "A45", "Indian Defense"],
  ["d4 Nf6 Bg5", "A45", "Trompowsky Attack"],
  ["d4 Nf6 c4", "A50", "Indian Defense"],
  ["d4 Nf6 c4 g6", "E60", "King's Indian Defense", "kings_indian_defense"],
  ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6", "E70", "King's Indian Defense: Normal Variation", "kings_indian_defense"],
  ["d4 Nf6 c4 g6 Nc3 d5", "D80", "Grünfeld Defense"],
  ["d4 Nf6 c4 e6 Nc3 Bb4", "E20", "Nimzo-Indian Defense"],
  ["d4 Nf6 c4 e6 Nf3 b6", "E12", "Queen's Indian Defense"],
  ["d4 Nf6 c4 c5", "A56", "Benoni Defense"],
  ["d4 f5", "A80", "Dutch Defense"],
  ["c4", "A10", "English Opening"],
  ["Nf3", "A04", "Zukertort Opening"],
  ["Nf3 d5 c4", "A09", "Réti Opening"],
  ["b3", "A01", "Nimzo-Larsen Attack"],
  ["f4", "A02", "Bird's Opening"],
  ["g3", "A00", "Hungarian Opening"],
].map(([line, eco, name, corpus]) => ({ moves: line.split(" "), eco, name, corpus }));

export const BOOK_DEPTH = Math.max(...OPENINGS.map((o) => o.moves.length));

/** @param {string[]} sanMoves */
export function classifyOpening(sanMoves) {
  let best = null;
  for (const o of OPENINGS) {
    if (o.moves.length > sanMoves.length) continue;
    if (o.moves.every((m, i) => m === sanMoves[i]) && (!best || o.moves.length > best.moves.length)) best = o;
  }
  return best ? { eco: best.eco, name: best.name, corpus: best.corpus || null, plies: best.moves.length } : null;
}

// A move is "book" when the sequence up to and including it is a known line.
export function isBookMove(sanMoves, plyIndex) {
  const prefix = sanMoves.slice(0, plyIndex + 1);
  return OPENINGS.some((o) => o.moves.length >= prefix.length && prefix.every((m, i) => m === o.moves[i]));
}
