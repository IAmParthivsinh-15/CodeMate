import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDb from "./config/db.js";
import authRoutes from "./routes/auth.js";
import gameRoutes from "./routes/game.js";
import { getBestMoveHandler } from "./controller/testEngine.js"

import cookieParser from 'cookie-parser';


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser()); 
const PORT = process.env.PORT;

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/game",gameRoutes);
app.get("/test",getBestMoveHandler)

connectDb();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
