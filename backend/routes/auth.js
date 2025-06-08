import express from "express";
import protectRoutes from "../middlewares/auth.js";
import {
  login,
  register,
  logout,
  refreshToken,
  getUserProfile,
} from "../controller/auth.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/logout", logout);
router.post("/refresh", refreshToken);
router.get("/me", protectRoutes, getUserProfile);

export default router;
