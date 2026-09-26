import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { env } from "../../config/env.js";
import { childLogger } from "../logger/index.js";
import { parseInfoLine, parseBestMove } from "./uci.js";

const log = childLogger("stockfish");
const here = path.dirname(fileURLToPath(import.meta.url));

// Resolved relative to this file (not process.cwd()), so the server can be
// started from any directory. STOCKFISH_PATH overrides it.
export function resolveStockfishPath() {
  if (env.STOCKFISH_PATH) return env.STOCKFISH_PATH;
  const exe = process.platform === "win32" ? "stockfish.exe" : "stockfish";
  return path.resolve(here, "../../../engine", exe);
}

// Bot strength per difficulty. Elo figures match the README and are used as
// the bot's rating when AI games are rated.
export const DIFFICULTY = Object.freeze({
  beginner: { skill: 0, depth: 5, elo: 1000 },
  intermediate: { skill: 5, depth: 8, elo: 1500 },
  advanced: { skill: 10, depth: 12, elo: 1800 },
  master: { skill: 15, depth: 15, elo: 2100 },
  grandmaster: { skill: 20, depth: 18, elo: 2400 },
  legendary: { skill: 20, depth: 22, elo: 2700 },
});
export const DIFFICULTIES = Object.keys(DIFFICULTY);

/**
 * One Stockfish process. Searches are serialised through a promise chain, so
 * concurrent callers can never interleave UCI commands (the previous version
 * ran two searches at once on one process and mixed up their output).
 */
export class UciEngine {
  constructor(binPath = resolveStockfishPath()) {
    this.binPath = binPath;
    this.queue = Promise.resolve();
    this.listeners = new Set();
    this.buffer = "";
    this.proc = null;
  }

  async start() {
    if (this.proc) return;
    if (!fs.existsSync(this.binPath)) throw new Error(`Stockfish binary not found at ${this.binPath}`);
    if (process.platform !== "win32") {
      try { fs.chmodSync(this.binPath, 0o755); } catch { /* read-only FS: must already be executable */ }
    }
    this.proc = spawn(this.binPath, [], { stdio: ["pipe", "pipe", "pipe"] });
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => {
      this.buffer += chunk;
      let idx;
      while ((idx = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (line) for (const l of this.listeners) l(line);
      }
    });
    this.proc.stderr.on("data", (d) => log.warn({ stderr: d.toString() }, "Stockfish stderr"));
    this.proc.on("exit", (code) => {
      log.warn({ code }, "Stockfish exited");
      this.proc = null;
    });
    this.proc.on("error", (err) => log.error({ err }, "Stockfish process error"));
    this.send("uci");
    await this.#waitFor((l) => l === "uciok", 10000);
    await this.ready();
  }

  send(cmd) {
    if (!this.proc) throw new Error("Engine not started");
    this.proc.stdin.write(`${cmd}\n`);
  }

  #waitFor(predicate, timeoutMs, onLine) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.listeners.delete(listener); reject(new Error("Stockfish timeout")); }, timeoutMs);
      const listener = (line) => {
        onLine?.(line);
        if (predicate(line)) {
          clearTimeout(timer);
          this.listeners.delete(listener);
          resolve(line);
        }
      };
      this.listeners.add(listener);
    });
  }

  async ready() {
    this.send("isready");
    await this.#waitFor((l) => l === "readyok", 10000);
  }

  /**
   * Search one position. Returns the final (deepest) principal line.
   * @param {{fen:string, depth?:number, movetime?:number, skill?:number, multipv?:number}} opts
   */
  search({ fen, depth = 12, movetime, skill = 20, multipv = 1, timeoutMs = 30000 }) {
    const run = async () => {
      await this.start();
      this.send(`setoption name Skill Level value ${skill}`);
      this.send(`setoption name MultiPV value ${multipv}`);
      this.send("ucinewgame");
      await this.ready();
      this.send(`position fen ${fen}`);
      const lines = new Map(); // multipv -> latest info at highest depth
      const go = movetime ? `go movetime ${movetime}` : `go depth ${depth}`;
      this.send(go);
      const bestLine = await this.#waitFor((l) => l.startsWith("bestmove"), timeoutMs, (l) => {
        const info = parseInfoLine(l);
        if (info) {
          const prev = lines.get(info.multipv);
          if (!prev || info.depth >= prev.depth) lines.set(info.multipv, info);
        }
      });
      const { bestMove, ponder } = parseBestMove(bestLine);
      const main = lines.get(1);
      return {
        bestMove,
        ponder,
        depth: main?.depth ?? 0,
        score: main?.score ?? null, // side-to-move POV; null when the game is already over
        pv: main?.pv ?? (bestMove ? [bestMove] : []),
        lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv),
      };
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }

  quit() {
    if (!this.proc) return;
    try { this.send("quit"); } catch { /* already gone */ }
    this.proc.kill();
    this.proc = null;
  }
}

/**
 * Fixed-size pool so concurrent requests don't spawn unbounded processes
 * (the old GET /test spawned one per request).
 */
export class EnginePool {
  constructor(size = env.ENGINE_POOL_SIZE) {
    this.size = size;
    this.engines = [];
    this.idle = [];
    this.waiters = [];
  }

  async #acquire() {
    if (this.idle.length) return this.idle.pop();
    if (this.engines.length < this.size) {
      const e = new UciEngine();
      this.engines.push(e);
      return e;
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  #release(engine) {
    const next = this.waiters.shift();
    if (next) next(engine);
    else this.idle.push(engine);
  }

  async search(opts) {
    const engine = await this.#acquire();
    try {
      return await engine.search(opts);
    } catch (err) {
      engine.quit(); // a timed-out engine may still be searching: replace it
      this.engines = this.engines.filter((e) => e !== engine);
      const fresh = new UciEngine();
      this.engines.push(fresh);
      this.#release(fresh);
      throw err;
    } finally {
      if (this.engines.includes(engine)) this.#release(engine);
    }
  }

  shutdown() {
    for (const e of this.engines) e.quit();
    this.engines = [];
    this.idle = [];
  }
}

let pool;
export const enginePool = () => pool || (pool = new EnginePool());

// Bot move at a difficulty level.
export async function getBotMove(fen, difficulty = "intermediate") {
  const cfg = DIFFICULTY[difficulty] || DIFFICULTY.intermediate;
  const res = await enginePool().search({ fen, depth: cfg.depth, skill: cfg.skill });
  return res.bestMove;
}

export const shutdownEngines = () => pool?.shutdown();
