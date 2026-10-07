import { env } from "../../config/env.js";
import { metrics } from "../metrics/index.js";
import { childLogger } from "../logger/index.js";

const log = childLogger("judge0");

// User code is only ever executed inside Judge0's sandbox, never in this
// process (spec §29).

// Judge0 CE language ids.
export const LANGUAGES = Object.freeze({
  javascript: { id: 63, name: "JavaScript (Node.js)" },
  python: { id: 71, name: "Python 3" },
  java: { id: 62, name: "Java" },
  cpp: { id: 54, name: "C++ (GCC)" },
});
export const LANGUAGE_KEYS = Object.keys(LANGUAGES);

// Judge0 CE status ids → our submission statuses.
export function mapStatus(id) {
  if (id === 3) return "accepted";
  if (id === 4) return "wrong_answer";
  if (id === 5) return "time_limit_exceeded";
  if (id === 6) return "compilation_error";
  if (id >= 7 && id <= 12) return "runtime_error";
  return "internal_error"; // 13 internal error, 14 exec format error, unknown
}

// ---------------------------------------------------------- legacy wrappers
// Problems created before Phase 11 expect a function `solve(n, arr)` and a
// two-line stdin (n, then n integers). New problems use mode "stdio".
const WRAPPERS = {
  javascript: (code) => `${code}

const __lines = require("fs").readFileSync(0, "utf8").trim().split("\\n");
const __n = parseInt(__lines[0], 10);
const __arr = (__lines[1] || "").trim().split(/\\s+/).filter(Boolean).map(Number);
console.log(solve(__n, __arr));
`,
  python: (code) => `${code}

n = int(input())
arr = list(map(int, input().split()))
print(solve(n, arr))
`,
  cpp: (code) => `#include <bits/stdc++.h>
using namespace std;

${code}

int main() {
    int n;
    cin >> n;
    vector<int> arr(n);
    for (int i = 0; i < n; i++) cin >> arr[i];
    cout << solve(n, arr) << endl;
    return 0;
}
`,
  java: (code) => `import java.util.*;

public class Main {
    ${code}

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n = scanner.nextInt();
        int[] arr = new int[n];
        for (int i = 0; i < n; i++) arr[i] = scanner.nextInt();
        System.out.println(solve(n, arr));
        scanner.close();
    }
}
`,
};

export const prepareSource = (code, language, mode) => (mode === "function" ? WRAPPERS[language](code) : code);

// Whitespace-tolerant comparison: trailing spaces per line and trailing blank lines don't matter.
export const normalizeOutput = (s = "") => s.replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd()).join("\n").trimEnd();

const b64 = (s) => Buffer.from(s ?? "", "utf8").toString("base64");
const unb64 = (s) => (s ? Buffer.from(s, "base64").toString("utf8") : "");

export class Judge0Client {
  constructor({ baseUrl = env.JUDGE0_API_URL, apiKey = env.JUDGE0_API_KEY, rapidApiHost = env.JUDGE0_RAPIDAPI_HOST } = {}) {
    this.baseUrl = baseUrl?.replace(/\/$/, "");
    // Backward compatible with the original RapidAPI setup (host was hard-coded).
    const host = rapidApiHost || (this.baseUrl?.includes("rapidapi.com") ? new URL(this.baseUrl).host : null);
    this.headers = { "content-type": "application/json" };
    if (host) {
      this.headers["x-rapidapi-host"] = host;
      if (apiKey) this.headers["x-rapidapi-key"] = apiKey;
    } else if (apiKey) {
      this.headers["X-Auth-Token"] = apiKey;
    }
    this.pollIntervalMs = 500;
    this.timeoutMs = 20000;
  }

  get configured() { return !!this.baseUrl; }

  async #request(path, init = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers: this.headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Judge0 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }

  async runOne({ source, languageId, stdin, timeLimitSec = 2, memoryLimitKb = 128000 }) {
    const end = metrics.judge0Duration.startTimer();
    try {
      const { token } = await this.#request("/submissions?base64_encoded=true&wait=false", {
        method: "POST",
        body: JSON.stringify({
          source_code: b64(source),
          stdin: b64(stdin),
          language_id: languageId,
          cpu_time_limit: timeLimitSec,
          memory_limit: memoryLimitKb,
        }),
      });
      const started = Date.now();
      while (Date.now() - started < this.timeoutMs) {
        const r = await this.#request(`/submissions/${token}?base64_encoded=true&fields=stdout,stderr,compile_output,status,time,memory`);
        if (r.status?.id > 2) {
          return {
            statusId: r.status.id,
            stdout: unb64(r.stdout),
            stderr: unb64(r.stderr),
            compileOutput: unb64(r.compile_output),
            time: r.time != null ? Number(r.time) : null,
            memory: r.memory ?? null,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      }
      throw new Error("Judge0 evaluation timed out");
    } finally {
      end();
    }
  }

  /**
   * Run code against test cases (limited concurrency). Stops early after a
   * compilation error, since every other test would fail the same way.
   * @returns {Promise<Array>} results in test order
   */
  async runTests({ code, language, mode, tests, timeLimitSec, memoryLimitKb, concurrency = 3 }) {
    const lang = LANGUAGES[language];
    if (!lang) throw new Error(`Unsupported language: ${language}`);
    const source = prepareSource(code, language, mode);
    const results = new Array(tests.length);
    let next = 0;
    let compileError = null;

    const worker = async () => {
      while (next < tests.length && !compileError) {
        const i = next++;
        const t = tests[i];
        try {
          const r = await this.runOne({ source, languageId: lang.id, stdin: t.input, timeLimitSec, memoryLimitKb });
          let status = mapStatus(r.statusId);
          const output = normalizeOutput(r.stdout);
          const expected = normalizeOutput(t.output);
          if (status === "accepted" && output !== expected) status = "wrong_answer";
          if (status === "compilation_error") compileError = r.compileOutput || r.stderr;
          results[i] = { index: i, hidden: !!t.hidden, input: t.input, expected, output, status, passed: status === "accepted", time: r.time, memory: r.memory, error: r.stderr || r.compileOutput || "" };
        } catch (err) {
          log.warn({ err: err.message }, "Judge0 test failed to run");
          results[i] = { index: i, hidden: !!t.hidden, input: t.input, expected: t.output, output: "", status: "internal_error", passed: false, error: err.message };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, tests.length) }, worker));
    // Tests skipped after a compile error inherit it.
    for (let i = 0; i < tests.length; i++) {
      if (!results[i]) results[i] = { index: i, hidden: !!tests[i].hidden, input: tests[i].input, expected: tests[i].output, output: "", status: "compilation_error", passed: false, error: compileError || "" };
    }
    return { results, compileOutput: compileError };
  }
}

let client;
export const judge0 = () => client || (client = new Judge0Client());
