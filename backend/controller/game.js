import User from "../model/user.js";
import GameSession from "../model/gameSession.js";
import ChessEngine from "../services/chessEngine.js";

export const startGame = async (req, res) => {
  try {
    const { opponent, difficulty } = req.body;

    if (!opponent) {
      return res.status(400).json({ message: "Opponent is required" });
    }

    const game = new GameSession({
      player: req.user._id,
      opponent: opponent,
      difficulty: opponent === "computer" ? difficulty : "pass-and-play",
    });

    await game.save();
    res.status(201).json({
      message: "Game started successfully",
      gameId: game._id,
      currentFEN: game.currentFEN,
      game,
    });
  } catch (error) {
    console.error("Error starting game:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const saveGame = async (req, res) => {
  try {
    const { gameId, move, fen } = req.body;

    const game = await GameSession.findByIdAndUpdate(
      gameId,
      {
        $push: {
          moves: {
            move: move,
            fen: fen,
          },
        },
        $set: {
          currentFEN: fen,
        },
      },
      {
        new: true,
      }
    );

    res.status(200).json({
      message: "Game saved successfully",
      gameId: game._id,
      currentFEN: game.currentFEN,
      moves: game.moves,
    });
  } catch (error) {
    console.error("Error saving game:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const endGame = async (req, res) => {
  try {
    const { gameId, status } = req.body;

    const game = await GameSession.findByIdAndUpdate(
      gameId,
      {
        status: status,
        endedAt: Date.now(),
      },
      { new: true }
    );

    await updateUserStats(req.user._id, status);

    res.status(200).json({
      message: "Game ended successfully",
      gameId: game._id,
      status: game.status,
      currentFEN: game.currentFEN,
      moves: game.moves,
    });
  } catch (error) {
    console.error("Error ending game:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateUserStats = async (userId, result) => {
  const update = {};
  if (result === "won") update.$inc = { "chessStats.wins": 1 };
  else if (result === "lost") update.$inc = { "chessStats.losses": 1 };
  else update.$inc = { "chessStats.draws": 1 };

  await User.findByIdAndUpdate(userId, update);
};

export const getMoveForBot = async (req, res) => {
  try {
    const { gameId, fen, difficulty } = req.body;
    if (!gameId || !fen || !difficulty) {
      return res
        .status(400)
        .json({ message: "Game ID, FEN, and difficulty are required" });
    }
    const game = await GameSession.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }
    const engine = new ChessEngine(difficulty);
    const bestMove = await engine.getBestMove(fen);
    if (!bestMove) {
      return res
        .status(500)
        .json({ message: "Failed to get best move from bot" });
    }
    // Save the move to the game session
    game.moves.push({ move: bestMove, fen: fen });
    game.currentFEN = fen;
    await game.save();
    res.status(200).json({
      message: "Best move retrieved successfully",
      bestMove: bestMove,
      currentFEN: game.currentFEN,
      moves: game.moves,
    });
  } catch (error) {
    console.error("Error getting move for bot:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
