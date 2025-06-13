import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDb from "./config/db.js";
import authRoutes from "./routes/auth.js";
import gameRoutes from "./routes/game.js";
import adminRoutes from "./routes/admin.js";
import codeRoutes from './routes/code.js';
import queRoutes from './routes/codingQuestion.js';
import gameAnalysisRoutes from "./routes/gameAnalysis.js";
import { getBestMoveHandler } from "./controller/testEngine.js";


import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());
const PORT = process.env.PORT;

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/code', codeRoutes);
app.use("/api/coding-questions",queRoutes)
app.use("/api/game-analysis",gameAnalysisRoutes)
app.get("/test", getBestMoveHandler);

app.get("/", (req, res) => {
  res.send("Welcome to the Chess Game API");
});

connectDb();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
