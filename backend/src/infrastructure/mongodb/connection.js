import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { childLogger } from "../logger/index.js";

const log = childLogger("mongodb");

export default async function connectDB(url = env.MONGO_URL) {
  mongoose.set("strictQuery", true);
  mongoose.connection.on("disconnected", () => log.warn("MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => log.info("MongoDB reconnected"));
  await mongoose.connect(url, { serverSelectionTimeoutMS: 15000 });
  log.info("MongoDB connected");
}

export const disconnectDB = () => mongoose.disconnect();
