// Seeds a starter set of stdin/stdout coding problems. Idempotent (upsert by slug).
// Usage: npm run seed:problems
import CodingQuestion from "../src/modules/coding/codingQuestion.model.js";
import { runScript } from "./_bootstrap.js";

const starter = (fnComment) => ({
  python: `import sys\n\ndef main():\n    data = sys.stdin.read().split()\n    # ${fnComment}\n\nmain()\n`,
  javascript: `const data = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/);\n// ${fnComment}\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // ${fnComment}\n    return 0;\n}\n`,
  java: `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        // ${fnComment}\n    }\n}\n`,
});

const PROBLEMS = [
  {
    title: "Material Count", slug: "material-count", difficulty: "beginner", tags: ["strings", "chess"],
    statement: "Given the piece-placement part of a FEN string, print White's material minus Black's material using P=1, N=3, B=3, R=5, Q=9 (kings count 0). Uppercase letters are White, lowercase are Black.",
    inputFormat: "One line: the piece-placement field of a FEN (e.g. rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR).",
    outputFormat: "One integer.", constraints: "The string is a valid FEN placement field.",
    samples: [{ input: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", output: "0" }, { input: "4k3/8/8/8/8/8/8/3QK3", output: "9" }],
    testcases: [{ input: "r3k3/8/8/8/8/8/8/4K2R", output: "0" }, { input: "4k3/pppp4/8/8/8/8/8/4KB2", output: "-1" }, { input: "4k3/8/8/8/8/8/8/2RRK3", output: "10" }],
  },
  {
    title: "Knight Moves", slug: "knight-moves", difficulty: "beginner", tags: ["simulation", "chess"],
    statement: "A knight stands on an empty board. Print how many squares it can move to.",
    inputFormat: "One square in algebraic notation, e.g. b1.", outputFormat: "One integer.", constraints: "The square is valid (a1-h8).",
    samples: [{ input: "b1", output: "3" }, { input: "d4", output: "8" }],
    testcases: [{ input: "a1", output: "2" }, { input: "h8", output: "2" }, { input: "a4", output: "4" }, { input: "g7", output: "4" }],
  },
  {
    title: "Two Sum Count", slug: "two-sum-count", difficulty: "intermediate", tags: ["arrays", "hashing"],
    statement: "Given n integers and a target t, count the pairs of indices i < j with a[i] + a[j] = t.",
    inputFormat: "First line: n and t. Second line: n integers.", outputFormat: "One integer: the number of pairs.", constraints: "1 <= n <= 200000; |a[i]|, |t| <= 10^9.",
    samples: [{ input: "5 6\n1 5 3 3 2", output: "2" }],
    testcases: [{ input: "4 4\n2 2 2 2", output: "6" }, { input: "3 10\n1 2 3", output: "0" }, { input: "6 0\n-1 1 -2 2 0 0", output: "3" }],
  },
  {
    title: "Longest Winning Streak", slug: "longest-winning-streak", difficulty: "beginner", tags: ["arrays", "strings"],
    statement: "A player's results are given as a string of W (win), D (draw) and L (loss). Print the length of the longest run of consecutive wins.",
    inputFormat: "One line of W, D and L characters.", outputFormat: "One integer.", constraints: "1 <= length <= 10^5.",
    samples: [{ input: "WWDWWWL", output: "3" }],
    testcases: [{ input: "LLLL", output: "0" }, { input: "W", output: "1" }, { input: "WDWDWWWWDW", output: "4" }],
  },
  {
    title: "Elo Expected Score", slug: "elo-expected-score", difficulty: "intermediate", tags: ["math", "chess"],
    statement: "Given two Elo ratings A and B, print player A's expected score 1 / (1 + 10^((B - A) / 400)) rounded to 3 decimal places.",
    inputFormat: "Two integers A and B.", outputFormat: "One number with exactly 3 decimals.", constraints: "100 <= A, B <= 3500.",
    samples: [{ input: "1500 1500", output: "0.500" }, { input: "1800 1400", output: "0.909" }],
    testcases: [{ input: "1400 1800", output: "0.091" }, { input: "2000 2100", output: "0.360" }, { input: "1000 2700", output: "0.000" }],
  },
  {
    title: "Queens Attack", slug: "queens-attack", difficulty: "advanced", tags: ["simulation", "chess", "grids"],
    statement: "On an n x n board, a queen stands at (rq, cq) and there are k obstacles. Print how many squares the queen attacks (it cannot pass through or capture obstacles).",
    inputFormat: "First line: n and k. Second line: rq cq. Next k lines: r c of each obstacle.", outputFormat: "One integer.", constraints: "1 <= n <= 10^5; 0 <= k <= 10^5; rows and columns are 1-based.",
    samples: [{ input: "4 0\n4 4", output: "9" }],
    testcases: [{ input: "5 3\n4 3\n5 5\n4 2\n2 3", output: "10" }, { input: "1 0\n1 1", output: "0" }, { input: "8 0\n4 4", output: "27" }],
  },
  {
    title: "Balanced Brackets", slug: "balanced-brackets", difficulty: "intermediate", tags: ["stacks", "strings"],
    statement: "Print YES if the string of brackets ()[]{} is balanced, otherwise NO.",
    inputFormat: "One line of bracket characters.", outputFormat: "YES or NO.", constraints: "1 <= length <= 10^5.",
    samples: [{ input: "{[()]}", output: "YES" }, { input: "([)]", output: "NO" }],
    testcases: [{ input: "((", output: "NO" }, { input: "()[]{}", output: "YES" }, { input: "]", output: "NO" }],
  },
  {
    title: "Shortest Knight Path", slug: "shortest-knight-path", difficulty: "advanced", tags: ["graphs", "bfs", "chess"],
    statement: "Print the minimum number of knight moves from square s to square t on an 8x8 board.",
    inputFormat: "One line: two squares, e.g. a1 h8.", outputFormat: "One integer.", constraints: "Both squares are valid.",
    samples: [{ input: "a1 h8", output: "6" }, { input: "e4 e4", output: "0" }],
    testcases: [{ input: "a1 b3", output: "1" }, { input: "a1 b2", output: "4" }, { input: "b1 c3", output: "1" }, { input: "h1 a8", output: "6" }],
  },
];

runScript("seed:problems", async () => {
  for (const p of PROBLEMS) {
    await CodingQuestion.updateOne(
      { slug: p.slug },
      { $set: { ...p, mode: "stdio", starterCode: starter("read the input, print the answer"), published: true } },
      { upsert: true }
    );
  }
  console.log(`Seeded ${PROBLEMS.length} problems.`);
});
