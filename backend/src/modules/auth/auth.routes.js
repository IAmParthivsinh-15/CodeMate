import express from "express";
import { protectRoutes } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { limiters } from "../../middleware/rateLimit.js";
import { login, register, logout, refreshToken, getUserProfile } from "./auth.controller.js";
import { registerSchema, loginSchema, refreshSchema } from "./auth.schema.js";

const router = express.Router();

router.post("/login", limiters.auth, validate({ body: loginSchema }), login);
router.post("/register", limiters.auth, validate({ body: registerSchema }), register);
router.post("/logout", logout);
router.post("/refresh", limiters.auth, validate({ body: refreshSchema }), refreshToken);
router.get("/me", protectRoutes, getUserProfile);

export default router;
