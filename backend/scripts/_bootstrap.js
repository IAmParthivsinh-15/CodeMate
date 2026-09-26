import { env } from "../src/config/env.js";
import connectDB, { disconnectDB } from "../src/infrastructure/mongodb/connection.js";

// Shared wrapper for CLI scripts: connect, run, disconnect, exit with a status.
export async function runScript(name, fn) {
  try {
    await connectDB(env.MONGO_URL);
    await fn();
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error(`${name} failed:`, err.message);
    await disconnectDB().catch(() => {});
    process.exit(1);
  }
}
