import express from "express";
import { addQuestion ,getAquestion} from "../controller/codingQuestions.js";
import { protectAdminRoutes } from "../middlewares/auth.js";

const router = express.Router();

router.post("/add-question", protectAdminRoutes, addQuestion);
router.get("/get-a-question", protectAdminRoutes, getAquestion);

export default router;
