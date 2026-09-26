import express from "express";
import { z } from "zod";
import CodingQuestion from "./codingQuestion.model.js";
import Submission from "./submission.model.js";
import { protectRoutes } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { limiters } from "../../middleware/rateLimit.js";
import { LANGUAGES, LANGUAGE_KEYS, judge0 } from "../../infrastructure/judge0/codeExecutor.js";
import { createSubmission, findProblem, problemView, submissionView, recommendProblem } from "./coding.service.js";
import { objectId } from "../games/game.schema.js";
import { ok, parsePagination, paginated } from "../../shared/http.js";
import { notFound } from "../../shared/errors.js";

// /api/coding (spec §29, §41)
const router = express.Router();
router.use(protectRoutes);

const DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced", "master", "grandmaster", "legendary"];

const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  difficulty: z.enum(DIFFICULTY_LEVELS).optional(),
  tag: z.string().max(40).optional(),
  search: z.string().max(80).optional(),
});

router.get("/languages", (req, res) =>
  ok(res, { languages: LANGUAGE_KEYS.map((k) => ({ key: k, name: LANGUAGES[k].name })), executionAvailable: judge0().configured })
);

router.get("/problems", validate({ query: listQuery }), async (req, res) => {
  const q = req.validatedQuery;
  const page = parsePagination(q);
  const filter = { published: { $ne: false } };
  if (q.difficulty) filter.difficulty = q.difficulty;
  if (q.tag) filter.tags = q.tag;
  if (q.search) filter.title = { $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const [items, total, solvedIds] = await Promise.all([
    CodingQuestion.find(filter).select("title slug difficulty tags mode").sort({ createdAt: 1 }).skip(page.skip).limit(page.limit).lean(),
    CodingQuestion.countDocuments(filter),
    Submission.distinct("problem", { user: req.user._id, status: "accepted", kind: "submit" }),
  ]);
  const solved = new Set(solvedIds.map(String));
  ok(res, paginated(items.map((p) => ({ ...p, solved: solved.has(String(p._id)) })), total, page));
});

// A problem to solve for a hint, matched to the player's chess rating.
router.get("/problems/recommended", async (req, res) => ok(res, await recommendProblem(req.user)));

router.get("/tags", async (req, res) => ok(res, { tags: (await CodingQuestion.distinct("tags")).sort() }));

router.get("/problems/:idOrSlug", validate({ params: z.object({ idOrSlug: z.string().min(1).max(120) }) }), async (req, res) => {
  const problem = await findProblem(req.params.idOrSlug);
  const solved = !!(await Submission.exists({ user: req.user._id, problem: problem._id, status: "accepted", kind: "submit" }));
  ok(res, { problem: problemView(problem, { solved }) });
});

const submitSchema = z.object({
  problemId: z.string().min(1).max(120),
  language: z.enum(LANGUAGE_KEYS),
  code: z.string().min(1, "Code is required").max(65536),
  kind: z.enum(["run", "submit"]).default("submit"),
});

// Asynchronous (spec §30): 202 + poll GET /submissions/:id, or listen for
// the submission:update socket event.
router.post("/submissions", limiters.code, validate({ body: submitSchema }), async (req, res) => {
  const submission = await createSubmission(req.user, req.body);
  res.status(202).json({ success: true, submission: submissionView(submission) });
});

const subsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  problemId: objectId.optional(),
  status: z.string().max(40).optional(),
});

router.get("/submissions", validate({ query: subsQuery }), async (req, res) => {
  const q = req.validatedQuery;
  const page = parsePagination(q);
  const filter = { user: req.user._id };
  if (q.problemId) filter.problem = q.problemId;
  if (q.status) filter.status = q.status;
  const [items, total] = await Promise.all([
    Submission.find(filter).select("-code -testResults").sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).populate("problem", "title slug difficulty"),
    Submission.countDocuments(filter),
  ]);
  ok(res, paginated(items.map((s) => ({ ...submissionView(s), problem: s.problem })), total, page));
});

router.get("/submissions/:id", validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const s = await Submission.findOne({ _id: req.params.id, user: req.user._id }).populate("problem", "title slug difficulty");
  if (!s) throw notFound("Submission");
  ok(res, { submission: { ...submissionView(s, { withCode: true }), problem: s.problem } });
});

export default router;
