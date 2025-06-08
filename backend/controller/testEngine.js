import ChessEngine from "../services/chessEngine.js";

export async function getBestMoveHandler(req, res) {
  const { fen, level = "grandmaster" } = req.body;

  if (!fen) {
    return res.status(400).json({ error: "FEN string is required" });
  }

  const engine = new ChessEngine(level);

  try {
    const bestMove = await engine.getBestMove(fen);
    res.status(200).json({ bestMove });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    engine.destroy();
  }
}
