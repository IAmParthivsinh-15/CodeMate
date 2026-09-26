// Load .env before any other module reads process.env (geminiService reads its key at import time).
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDb from "./infrastructure/mongodb/connection.js";
import routes from "./routes/index.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());
const PORT = process.env.PORT;

// Routes
app.use(routes);

connectDb();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
