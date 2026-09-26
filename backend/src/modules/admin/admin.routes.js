import express from "express";
import { z } from "zod";
import { addAdmin, loginAdmin } from "./admin.controller.js";
import { protectAdminRoutes } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { limiters } from "../../middleware/rateLimit.js";
import checkRole from "../../middleware/checkRole.js";

const router = express.Router();

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });
const addSchema = z.object({
  username: z.string().trim().min(3).max(30),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10, "Admin passwords must be at least 10 characters"),
  role: z.enum(["admin", "superadmin"]).default("admin"),
});

router.post("/login", limiters.auth, validate({ body: loginSchema }), loginAdmin);
router.post("/add-admin", protectAdminRoutes, checkRole(["superadmin"]), validate({ body: addSchema }), addAdmin);

export default router;
