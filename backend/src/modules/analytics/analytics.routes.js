import express from "express";
import { z } from "zod";
import { protectRoutes } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getDashboard, getLeaderboard } from "./analytics.service.js";
import { ok } from "../../shared/http.js";

export const dashboardRouter = express.Router();
dashboardRouter.get("/", protectRoutes, async (req, res) => ok(res, await getDashboard(req.user._id)));

export const leaderboardRouter = express.Router();
leaderboardRouter.get("/", protectRoutes, validate({ query: z.object({ period: z.enum(["all", "month"]).default("all") }) }), async (req, res) =>
  ok(res, await getLeaderboard(req.validatedQuery.period))
);
