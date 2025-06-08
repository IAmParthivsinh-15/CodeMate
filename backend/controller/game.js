import User from "../model/user.js";
import GameSession from "../model/gameSession.js";

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
        status: result,
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
