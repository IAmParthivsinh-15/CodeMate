import express from "express";
import { addAdmin, loginAdmin } from "../controller/admin.js";
import { protectAdminRoutes } from "../middlewares/auth.js";
import checkRole from "../middlewares/checkRole.js";

const router = express.Router();

router.post("/login", loginAdmin);
router.post(
  "/add-admin",
  protectAdminRoutes,
  checkRole(["superadmin"]),
  addAdmin
);

export default router;
