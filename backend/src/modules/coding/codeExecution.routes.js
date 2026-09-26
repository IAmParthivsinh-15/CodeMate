import express from "express";
import { z } from "zod";
import { protectRoutes } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { limiters } from "../../middleware/rateLimit.js";
import { LANGUAGE_KEYS } from "../../infrastructure/judge0/codeExecutor.js";
import { executeLegacy } from "./coding.service.js";
import { objectId } from "../games/game.schema.js";

// Legacy synchronous endpoint, mounted at /api/code. Deprecated: use
// POST /api/coding/submissions.
const router = express.Router();

const executeSchema = z.object({
  code: z.string().min(1).max(65536),
  language: z.string().transform((s) => (s.toLowerCase() === "js" ? "javascript" : s.toLowerCase())).pipe(z.enum(LANGUAGE_KEYS)),
  questionId: objectId,
});

router.post("/execute", protectRoutes, limiters.code, validate({ body: executeSchema }), async (req, res) => {
  res.status(200).json(await executeLegacy(req.user, req.body));
});

export default router;
