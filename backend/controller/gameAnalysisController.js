import GameSession from '../model/gameSession.js';
import GameAnalysis from '../model/GameAnalysis.js';
import ChessEngine from '../services/chessEngine.js';
import geminiService from '../services/geminiService.js';
import { Chess } from 'chess.js';

class GameAnalysisController {
  async getAnalysis(req, res) {
    try {
      const { gameId } = req.body;
      
      const analysis = await GameAnalysis.findOne({ gameSession: gameId })
        .populate('gameSession');
      
      if (!analysis) {
        return res.status(404).json({ message: 'Analysis not found' });
      }
      
      res.json(analysis);
    } catch (error) {
      console.error('Get analysis error:', error);
      res.status(500).json({ message: error.message });
    }
  }

  async analyzeGame(req, res) {
    try {
      const { gameId } = req.body;
      const userId = req.user._id;
      
      const game = await GameSession.findOne({
        _id: gameId,
        player: userId
      });
      
      if (!game) {
        return res.status(404).json({ message: 'Game not found' });
      }
      
      const existingAnalysis = await GameAnalysis.findOne({ gameSession: gameId });
      if (existingAnalysis) {
        return res.json(existingAnalysis);
      }
      
      const analysis = await this.analyzeGameSession(game);
      
      const savedAnalysis = new GameAnalysis({
        gameSession: gameId,
        ...analysis
      });
      await savedAnalysis.save();
      
      res.json(savedAnalysis);
    } catch (error) {
      console.error('Game analysis error:', error);
      res.status(500).json({ message: error.message });
    }
  }

  async deleteAnalysis(req, res) {
    try {
      const { gameId } = req.body;
      const userId = req.user._id;

      const analysis = await GameAnalysis.findOne({ 
        gameSession: gameId,
        'gameSession.player': userId 
      });

      if (!analysis) {
        return res.status(404).json({ message: 'Analysis not found' });
      }

      await analysis.remove();
      res.json({ message: 'Analysis deleted successfully' });
    } catch (error) {
      console.error('Delete analysis error:', error);
      res.status(500).json({ message: error.message });
    }
  }

  // Core analysis function
  async analyzeGameSession(game) {
    const engine = new ChessEngine('legendary');
    await engine.initializeEngine();
    
    const analysis = {
      playerAccuracy: 0,
      computerAccuracy: 0,
      bestMoveCount: 0,
      inaccuracies: 0,
      mistakes: 0,
      blunders: 0,
      moveAnalysis: []
    };
    
    let totalPlayerAccuracy = 0;
    let totalComputerAccuracy = 0;
    let playerMoveCount = 0;
    let computerMoveCount = 0;
    
    const chess = new Chess();
    
    try {
      for (let i = 0; i < game.moves.length; i++) {
        const moveData = game.moves[i];
        const fenBefore = i === 0 ? 
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : 
          game.moves[i-1].fen;
        
        // Analyze position before move
        const positionAnalysis = await engine.analyzePosition(fenBefore);
        
        // Apply move to chess instance for validation
        chess.load(fenBefore);
        chess.move(moveData.move);
        
        const isPlayerMove = (i % 2 === 0 && game.opponent === 'computer') || 
                            (game.opponent === 'human' && game.player === game.userId);
        
        // Classify move quality
        const moveAccuracy = this.calculateMoveAccuracy(
          moveData.move, 
          positionAnalysis.bestMove, 
          positionAnalysis.evaluation
        );
        
        const classification = this.classifyMove(moveAccuracy);
        
        // Update statistics
        if (isPlayerMove) {
          totalPlayerAccuracy += moveAccuracy;
          playerMoveCount++;
        } else {
          totalComputerAccuracy += moveAccuracy;
          computerMoveCount++;
        }
        
        if (moveData.move === positionAnalysis.bestMove) {
          analysis.bestMoveCount++;
        }
        
        switch (classification) {
          case 'inaccuracy': analysis.inaccuracies++; break;
          case 'mistake': analysis.mistakes++; break;
          case 'blunder': analysis.blunders++; break;
        }
        
        // Save move analysis
        analysis.moveAnalysis.push({
          moveNumber: i + 1,
          playerMove: moveData.move,
          bestMove: positionAnalysis.bestMove,
          accuracy: moveAccuracy,
          classification,
          fenBefore,
          fenAfter: moveData.fen,
          evaluationBefore: positionAnalysis.evaluation,
          evaluationAfter: await engine.getPositionEvaluation(moveData.fen)
        });
      }
      
      analysis.playerAccuracy = playerMoveCount > 0 
        ? Math.round(totalPlayerAccuracy / playerMoveCount) 
        : 100;
        
      analysis.computerAccuracy = computerMoveCount > 0 
        ? Math.round(totalComputerAccuracy / computerMoveCount) 
        : 100;
      
      // Generate Gemini report
      analysis.geminiReport = await geminiService.generateGameAnalysisReport(
        {
          player: game.player,
          opponent: game.opponent,
          difficulty: game.difficulty,
          result: game.status,
          date: game.createdAt,
          playerAccuracy: analysis.playerAccuracy,
          computerAccuracy: analysis.computerAccuracy,
          bestMoves: analysis.bestMoveCount,
          mistakes: analysis.mistakes,
          blunders: analysis.blunders,
          totalMoves: game.moves.length
        },
        analysis.moveAnalysis
      );
      
      return analysis;
    } finally {
      engine.destroy();
    }
  }

  calculateMoveAccuracy(playerMove, bestMove, evaluation) {
    if (playerMove === bestMove) return 100;
    
    if (this.areMovesSimilar(playerMove, bestMove)) {
      return Math.max(70, 100 - Math.abs(evaluation)/10);
    }
    
    return Math.max(0, 100 - Math.abs(evaluation)/5);
  }

  areMovesSimilar(move1, move2) {
    return move1.substring(0, 2) === move2.substring(0, 2) || 
           move1.substring(2, 4) === move2.substring(2, 4);
  }

  classifyMove(accuracy) {
    if (accuracy >= 90) return 'excellent';
    if (accuracy >= 75) return 'good';
    if (accuracy >= 50) return 'inaccuracy';
    if (accuracy >= 25) return 'mistake';
    return 'blunder';
  }
}

export default new GameAnalysisController();
