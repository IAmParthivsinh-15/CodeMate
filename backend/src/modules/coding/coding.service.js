import mongoose from "mongoose";
import CodingQuestion from "./codingQuestion.model.js";
import Submission from "./submission.model.js";
import User from "../users/user.model.js";
import { judge0 } from "../../infrastructure/judge0/codeExecutor.js";
import { publish } from "../../infrastructure/kafka/index.js";
import { TOPICS } from "../../shared/events.js";
import { notFound, unavailable } from "../../shared/errors.js";
import { notifyUser } from "../../sockets/notify.js";

export const MAX_HINT_CREDITS = 5;

// Status precedence when tests disagree: the first non-accepted status wins,
// with compilation errors reported over everything else.
const summarise = (results) => {
  const failing = results.find((r) => r.status === "compilation_error") || results.find((r) => !r.passed);
  return failing ? failing.status : "accepted";
};

// Client view of a test result: hidden cases never reveal input or expected
// output (the old endpoint leaked them).
export const publicTestResult = (r) =>
  r.hidden
    ? { index: r.index, hidden: true, status: r.status, passed: r.passed, time: r.time, memory: r.memory }
    : r;

export const submissionView = (s, { withCode = false } = {}) => ({
  _id: s._id,
  problem: s.problem,
  language: s.language,
  kind: s.kind,
  status: s.status,
  passedCount: s.passedCount,
  totalCount: s.totalCount,
  score: s.score,
  executionTime: s.executionTime,
  memory: s.memory,
  compileOutput: s.compileOutput || null,
  testResults: (s.testResults || []).map(publicTestResult),
  firstAccept: s.firstAccept,
  createdAt: s.createdAt,
  completedAt: s.completedAt,
  ...(withCode ? { code: s.code } : {}),
});

export const problemView = (q, { solved = false } = {}) => ({
  _id: q._id,
  title: q.title,
  slug: q.slug,
  statement: q.statement,
  inputFormat: q.inputFormat,
  outputFormat: q.outputFormat,
  constraints: q.constraints,
  difficulty: q.difficulty,
  tags: q.tags,
  mode: q.mode || "function",
  starterCode: q.starterCode ? Object.fromEntries(q.starterCode instanceof Map ? q.starterCode : Object.entries(q.starterCode)) : {},
  samples: (q.samples || []).map((s) => ({ input: s.input, output: s.output })),
  timeLimitSec: q.timeLimitSec,
  memoryLimitKb: q.memoryLimitKb,
  solved,
});

export async function findProblem(idOrSlug) {
  const filter = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
  const q = await CodingQuestion.findOne({ ...filter, published: { $ne: false } });
  if (!q) throw notFound("Problem");
  return q;
}

export async function createSubmission(user, { problemId, language, code, kind }) {
  const problem = await findProblem(problemId);
  if (!judge0().configured) throw unavailable("Code execution is not configured (JUDGE0_API_URL)", "EXECUTION_UNAVAILABLE");
  const submission = await Submission.create({ user: user._id, problem: problem._id, language, code, kind });
  await publish(TOPICS.CODE_SUBMITTED, "code.submitted", { submissionId: String(submission._id), userId: String(user._id), problemId: String(problem._id) });
  return submission;
}

const testsFor = (problem, kind) => [
  ...(problem.samples || []).map((t) => ({ input: t.input, output: t.output, hidden: false })),
  ...(kind === "submit" ? (problem.testcases || []).map((t) => ({ input: t.input, output: t.output, hidden: true })) : []),
];

async function judge(problem, { code, language, kind, tests = testsFor(problem, kind) }) {
  const { results, compileOutput } = await judge0().runTests({
    code, language, mode: problem.mode || "function", tests,
    timeLimitSec: problem.timeLimitSec, memoryLimitKb: problem.memoryLimitKb,
  });
  const passedCount = results.filter((r) => r.passed).length;
  return {
    results,
    compileOutput,
    status: summarise(results),
    passedCount,
    totalCount: results.length,
    score: results.length ? Math.round((passedCount / results.length) * 100) : 0,
    executionTime: Math.max(0, ...results.map((r) => r.time || 0)),
    memory: Math.max(0, ...results.map((r) => r.memory || 0)),
  };
}

// Hidden test inputs/expected outputs aren't needed after judging; don't store them.
const storable = (r) => (r.hidden ? { ...r, input: undefined, expected: undefined, output: undefined } : r);

/**
 * Coding worker entry point. Idempotent: only a queued submission is claimed.
 */
export async function processSubmission(submissionId) {
  const sub = await Submission.findOneAndUpdate({ _id: submissionId, status: "queued" }, { status: "running" }, { new: true });
  if (!sub) return null; // already processed (duplicate event) or unknown
  notifyUser(sub.user, "submission:update", { submissionId: String(sub._id), status: "running" });
  const problem = await CodingQuestion.findById(sub.problem);
  let outcome;
  try {
    outcome = await judge(problem, sub);
  } catch (err) {
    outcome = { status: "internal_error", results: [], passedCount: 0, totalCount: 0, score: 0, compileOutput: err.message };
  }

  let firstAccept = false;
  if (outcome.status === "accepted" && sub.kind === "submit") {
    const earlier = await Submission.exists({ user: sub.user, problem: sub.problem, status: "accepted", kind: "submit", _id: { $ne: sub._id } });
    firstAccept = !earlier;
  }
  const done = await Submission.findByIdAndUpdate(
    sub._id,
    {
      status: outcome.status,
      passedCount: outcome.passedCount,
      totalCount: outcome.totalCount,
      score: outcome.score,
      executionTime: outcome.executionTime,
      memory: outcome.memory,
      compileOutput: outcome.compileOutput || undefined,
      testResults: outcome.results.map(storable),
      firstAccept,
      completedAt: new Date(),
    },
    { new: true }
  );

  if (sub.kind === "submit") {
    const inc = { "codingStats.submissions": 1 };
    if (outcome.status === "accepted") inc["codingStats.accepted"] = 1;
    if (firstAccept) inc["codingStats.problemsSolved"] = 1;
    await User.updateOne({ _id: sub.user }, { $inc: inc });
    // Solving a new problem earns an engine hint (capped).
    if (firstAccept) await User.updateOne({ _id: sub.user, hintCredits: { $lt: MAX_HINT_CREDITS } }, { $inc: { hintCredits: 1 } });
  }

  await publish(TOPICS.CODE_COMPLETED, "code.completed", {
    submissionId: String(done._id), userId: String(done.user), problemId: String(done.problem), status: done.status, kind: done.kind, firstAccept,
  });
  notifyUser(done.user, "submission:update", { submissionId: String(done._id), status: done.status, firstAccept });
  return done;
}

/**
 * Legacy synchronous POST /api/code/execute. Same response shape as before,
 * without leaking hidden test data; also recorded as a Submission.
 */
export async function executeLegacy(user, { code, language, questionId }) {
  const problem = await findProblem(questionId);
  if (!judge0().configured) throw unavailable("Code execution is not configured (JUDGE0_API_URL)", "EXECUTION_UNAVAILABLE");
  const started = Date.now();
  const samples = await judge(problem, { code, language, kind: "run" });
  let full = null;
  const hiddenTests = testsFor(problem, "submit").filter((t) => t.hidden);
  if (samples.status === "accepted") full = await judge(problem, { code, language, tests: hiddenTests });
  const hidden = full ? full.results : [];
  const passedHidden = hidden.filter((r) => r.passed).length;
  const score = hidden.length ? Math.round((passedHidden / hidden.length) * 100) : 0;

  const sub = await Submission.create({
    user: user._id, problem: problem._id, language, code, kind: "submit", status: "queued",
  });
  // Reuse the worker bookkeeping so stats and hint credits stay consistent.
  const final = full
    ? { ...full, status: full.status, passedCount: samples.passedCount + full.passedCount, totalCount: samples.totalCount + full.totalCount,
        results: [...samples.results, ...full.results.map((r) => ({ ...r, index: r.index + samples.totalCount }))] }
    : samples;
  const firstAccept = final.status === "accepted" && !(await Submission.exists({ user: user._id, problem: problem._id, status: "accepted", kind: "submit" }));
  await Submission.updateOne({ _id: sub._id }, {
    status: final.status, passedCount: final.passedCount, totalCount: final.totalCount, score,
    executionTime: final.executionTime, memory: final.memory, testResults: final.results.map(storable),
    firstAccept, completedAt: new Date(),
  });
  const inc = { "codingStats.submissions": 1 };
  if (final.status === "accepted") inc["codingStats.accepted"] = 1;
  if (firstAccept) inc["codingStats.problemsSolved"] = 1;
  await User.updateOne({ _id: user._id }, { $inc: inc });
  if (firstAccept) await User.updateOne({ _id: user._id, hintCredits: { $lt: MAX_HINT_CREDITS } }, { $inc: { hintCredits: 1 } });

  return {
    message: "Code executed successfully",
    question: {
      title: problem.title,
      description: problem.statement, // legacy field name
      statement: problem.statement,
      difficulty: problem.difficulty,
      inputFormat: problem.inputFormat,
      outputFormat: problem.outputFormat,
      constraints: problem.constraints,
      samples: problem.samples.map((s) => ({ input: s.input, output: s.output })),
    },
    execution: {
      samples: samples.results.map(publicTestResult),
      testCases: hidden.map(publicTestResult),
      score,
      passed: score === 100,
      language,
      timeTaken: Date.now() - started,
      submissionId: sub._id,
    },
  };
}
