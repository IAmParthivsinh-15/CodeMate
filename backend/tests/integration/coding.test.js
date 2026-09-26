import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { startTestServer, registerUser, eventually } from "../helpers.js";
import CodingQuestion from "../../src/modules/coding/codingQuestion.model.js";
import User from "../../src/modules/users/user.model.js";

// Fake Judge0: "runs" code by summing the integers on stdin. Code containing
// CORRECT prints the sum, COMPILE_ERR fails to compile, anything else prints 0.
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s) => Buffer.from(s, "base64").toString("utf8");
const realFetch = globalThis.fetch;
const submissions = new Map();
function fakeFetch(url, init = {}) {
  if (!String(url).startsWith("https://judge0.test")) return realFetch(url, init);
  const u = new URL(url);
  if (init.method === "POST") {
    const body = JSON.parse(init.body);
    const token = `t${submissions.size + 1}`;
    submissions.set(token, { code: unb64(body.source_code), stdin: unb64(body.stdin) });
    return Promise.resolve(new Response(JSON.stringify({ token }), { status: 201 }));
  }
  const { code, stdin } = submissions.get(u.pathname.split("/").pop());
  const sum = stdin.split(/\s+/).filter(Boolean).slice(1).map(Number).reduce((a, b) => a + b, 0);
  const result = code.includes("COMPILE_ERR")
    ? { status: { id: 6 }, compile_output: b64("error: expected ;"), stdout: null }
    : { status: { id: 3 }, stdout: b64(`${code.includes("CORRECT") ? sum : 0}\n`), time: "0.01", memory: 1000 };
  return Promise.resolve(new Response(JSON.stringify(result), { status: 200 }));
}

let t;
let problem;
beforeAll(async () => {
  vi.stubGlobal("fetch", fakeFetch);
  t = await startTestServer("cm_coding", { workers: true });
  problem = await CodingQuestion.create({
    title: "Array Sum", slug: "array-sum", statement: "Print the sum of the array.", inputFormat: "n then n ints", outputFormat: "sum",
    constraints: "n <= 100", difficulty: "beginner", tags: ["arrays"], mode: "stdio",
    samples: [{ input: "3\n1 2 3", output: "6" }],
    testcases: [{ input: "2\n5 5", output: "10" }, { input: "1\n42", output: "42" }],
  });
});
afterAll(async () => {
  await t.stop();
  vi.unstubAllGlobals();
});

describe("coding platform (spec §29-30)", () => {
  it("lists problems without hidden tests", async () => {
    const { auth } = await registerUser(t.api);
    const list = await t.api().get("/api/coding/problems").set(auth);
    expect(list.body.items[0]).toMatchObject({ slug: "array-sum", solved: false });
    const detail = await t.api().get("/api/coding/problems/array-sum").set(auth);
    expect(detail.body.problem.samples).toHaveLength(1);
    expect(detail.body.problem.testcases).toBeUndefined();
  });

  it("judges asynchronously, never leaks hidden cases, and awards a hint credit once", async () => {
    const { auth, user } = await registerUser(t.api);
    const sub = await t.api().post("/api/coding/submissions").set(auth).send({ problemId: String(problem._id), language: "python", code: "# CORRECT" });
    expect(sub.status).toBe(202);
    expect(sub.body.submission.status).toBe("queued");
    const done = await eventually(async () => {
      const r = await t.api().get(`/api/coding/submissions/${sub.body.submission._id}`).set(auth);
      return !["queued", "running"].includes(r.body.submission.status) && r.body.submission;
    });
    expect(done).toMatchObject({ status: "accepted", passedCount: 3, totalCount: 3, firstAccept: true });
    const hidden = done.testResults.filter((r) => r.hidden);
    expect(hidden).toHaveLength(2);
    for (const h of hidden) expect(h.input ?? h.expected ?? h.output).toBeUndefined();
    expect((await User.findById(user._id).lean()).hintCredits).toBe(1);

    const again = await t.api().post("/api/coding/submissions").set(auth).send({ problemId: "array-sum", language: "python", code: "# CORRECT again" });
    await eventually(async () => (await t.api().get(`/api/coding/submissions/${again.body.submission._id}`).set(auth)).body.submission.status === "accepted");
    const u = await User.findById(user._id).lean();
    expect(u.hintCredits).toBe(1); // only the first accept pays
    expect(u.codingStats).toMatchObject({ problemsSolved: 1, accepted: 2, submissions: 2 });
  });

  it("reports wrong answers and compilation errors", async () => {
    const { auth } = await registerUser(t.api);
    const wrong = await t.api().post("/api/coding/submissions").set(auth).send({ problemId: "array-sum", language: "javascript", code: "console.log(0)" });
    const ce = await t.api().post("/api/coding/submissions").set(auth).send({ problemId: "array-sum", language: "cpp", code: "COMPILE_ERR" });
    const status = async (id) => (await t.api().get(`/api/coding/submissions/${id}`).set(auth)).body.submission;
    const w = await eventually(async () => { const s = await status(wrong.body.submission._id); return s.status !== "queued" && s.status !== "running" && s; });
    const c = await eventually(async () => { const s = await status(ce.body.submission._id); return s.status !== "queued" && s.status !== "running" && s; });
    expect(w.status).toBe("wrong_answer");
    expect(c.status).toBe("compilation_error");
    expect(c.compileOutput).toContain("expected");
    const history = await t.api().get("/api/coding/submissions").set(auth);
    expect(history.body.items).toHaveLength(2);
    expect(history.body.items[0].code).toBeUndefined();
  });

  it("keeps the legacy synchronous /api/code/execute without leaking answers", async () => {
    const { auth } = await registerUser(t.api);
    const r = await t.api().post("/api/code/execute").set(auth).send({ code: "# CORRECT", language: "js", questionId: String(problem._id) });
    expect(r.status).toBe(200);
    expect(r.body.execution).toMatchObject({ score: 100, passed: true, language: "javascript" });
    expect(Number.isFinite(r.body.execution.timeTaken)).toBe(true);
    expect(r.body.question.description).toBe("Print the sum of the array.");
    for (const tc of r.body.execution.testCases) expect(tc.expected).toBeUndefined();
  });
});
