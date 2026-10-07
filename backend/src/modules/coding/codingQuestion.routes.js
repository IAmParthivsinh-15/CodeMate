import express from "express";
import { z } from "zod";
import { addQuestion, getAquestion, listAll, updateQuestion, deleteQuestion } from "./codingQuestion.controller.js";
import { protectAdminRoutes } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { LANGUAGE_KEYS } from "../../infrastructure/judge0/codeExecutor.js";
import { objectId } from "../games/game.schema.js";

// Admin-only question management, mounted at /api/coding-questions.
const router = express.Router();
router.use(protectAdminRoutes);

const testCase = z.object({ input: z.string().max(100_000), output: z.string().max(100_000) });
const questionSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Slug may contain a-z, 0-9 and -"),
  statement: z.string().min(10),
  inputFormat: z.string().min(1),
  outputFormat: z.string().min(1),
  constraints: z.string().min(1),
  samples: z.array(testCase).min(1),
  testcases: z.array(testCase).min(1),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "master", "grandmaster", "legendary"]),
  tags: z.array(z.string().trim().toLowerCase().max(30)).max(10).default([]),
  mode: z.enum(["stdio", "function"]).default("stdio"),
  starterCode: z.record(z.enum(LANGUAGE_KEYS), z.string().max(10_000)).optional(),
  timeLimitSec: z.number().min(0.5).max(10).optional(),
  memoryLimitKb: z.number().int().min(16_000).max(512_000).optional(),
  published: z.boolean().optional(),
});

router.post("/add-question", validate({ body: questionSchema }), addQuestion);
router.get("/get-a-question", getAquestion);
router.get("/", listAll);
router.patch("/:id", validate({ params: z.object({ id: objectId }), body: questionSchema.partial() }), updateQuestion);
router.delete("/:id", validate({ params: z.object({ id: objectId }) }), deleteQuestion);

export default router;
