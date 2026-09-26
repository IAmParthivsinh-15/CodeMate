import express from "express";
import { addQuestion ,getAquestion} from "./codingQuestion.controller.js";
import { protectAdminRoutes } from "../../middleware/auth.js";

const router = express.Router();

router.post("/add-question", protectAdminRoutes, addQuestion);
router.get("/get-a-question", protectAdminRoutes, getAquestion);

export default router;
