import express from "express";
import { addAdmin, loginAdmin } from "./admin.controller.js";
import { protectAdminRoutes } from "../../middleware/auth.js";
import checkRole from "../../middleware/checkRole.js";

const router = express.Router();

router.post("/login", loginAdmin);
router.post(
  "/add-admin",
  protectAdminRoutes,
  checkRole(["superadmin"]),
  addAdmin
);

export default router;
