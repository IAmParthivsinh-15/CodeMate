import { spawn } from "child_process";
import path from "path";
import fs from "fs";

class ChessEngine {
  constructor(difficulty = "intermediate") {
    if (!this.validateDifficulty(difficulty)) {
      throw new Error(`Invalid difficulty level: ${difficulty}`);
    }

    this.difficulty = difficulty;
    this.engine = null;
    this.lastOutput = "";
    this.stockfishPath = this.getStockfishPath();
    this.initializeEngine();
  }

  getStockfishPath() {
    const executableName = process.platform === "win32" ? "stockfish.exe" : "stockfish";
    const enginePath = path.join(process.cwd(), "engine", executableName);

    if (!fs.existsSync(enginePath)) {
      throw new Error(`Stockfish engine not found at ${enginePath}`);
    }

    console.log("Stockfish engine path:", enginePath);
    return enginePath;
  }

  validateDifficulty(difficulty) {
    const validLevels = [
      "beginner",
      "intermediate",
      "advanced",
      "master",
      "grandmaster",
      "legendary",
    ];
    return validLevels.includes(difficulty);
  }

  initializeEngine() {
    try {
      console.log("Initializing Stockfish engine...");

      // Skip chmod on Windows
      if (process.platform !== "win32") {
        try {
          fs.chmodSync(this.stockfishPath, "755");
        } catch (error) {
          console.warn("Failed to set executable permissions:", error);
        }
      }

      this.engine = spawn(this.stockfishPath);
      console.log("Stockfish engine spawned");

      this.engine.stdout.on("data", (data) => {
        this.lastOutput = data.toString();
        console.log("Engine output:", this.lastOutput);
      });

      this.engine.stderr.on("data", (data) => {
        console.error(`Stockfish error: ${data}`);
      });

      this.engine.on("error", (error) => {
        console.error("Engine spawn error:", error);
        throw error;
      });

      this.setDifficulty(this.difficulty);
    } catch (err) {
      console.error("Engine initialization error:", err);
      throw new Error(`Failed to initialize Stockfish: ${err.message}`);
    }
  }

  setDifficulty(difficulty) {
    const skillLevels = {
      beginner: {
        level: 0,
        depth: 5
      },
      intermediate: {
        level: 5,
        depth: 10
      },
      advanced: {
        level: 10,
        depth: 15
      },
      master: {
        level: 15,
        depth: 18
      },
      grandmaster: {
        level: 20,
        depth: 20
      },
      legendary: {
        level: 20,
        depth: 22
      }
    };

    const config = skillLevels[difficulty];
    this.sendCommand(`setoption name Skill Level value ${config.level}`);
    this.depth = config.depth;
    this.difficulty = difficulty;
  }

  sendCommand(command) {
    if (!this.engine) {
      throw new Error("Engine not initialized");
    }
    this.engine.stdin.write(`${command}\n`);
  }

  async getBestMove(fen) {
    return new Promise((resolve, reject) => {
      if (!this.engine) {
        return reject(new Error("Engine not initialized"));
      }

      let isResolved = false;

      const handler = (data) => {
        const output = data.toString();
        console.log('Engine output:', output);

        if (output.includes("bestmove") && !isResolved) {
          isResolved = true;
          cleanup();
          const move = this.parseBestMove(output);
          if (move) {
            resolve(move);
          } else {
            reject(new Error("Engine returned invalid move"));
          }
        }
      };

      const cleanup = () => {
        this.engine.stdout.removeListener("data", handler);
      };

      this.engine.stdout.on("data", handler);

      // Initialize the engine with the position
      this.sendCommand("ucinewgame");
      this.sendCommand("isready");
      this.sendCommand(`position fen ${fen}`);
      
      // Use depth instead of movetime
      setTimeout(() => {
        if (!isResolved) {
          this.sendCommand(`go depth ${this.depth}`);
        }
      }, 100);
    });
  }

  parseBestMove(output) {
    const match = output.match(/bestmove (\S+)/);
    if (!match) return null;

    const move = match[1];
    return move === "(none)" ? null : move;
  }

  destroy() {
    if (this.engine) {
      this.sendCommand("quit");
      this.engine.kill();
    }
  }
}

export default ChessEngine;