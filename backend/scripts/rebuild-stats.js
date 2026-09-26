// Recomputes the analytics aggregates (UserStats) from games and analyses.
// Usage: npm run stats:rebuild [-- <userId>]   (no id = every user)
import User from "../src/modules/users/user.model.js";
import { rebuildUserStats } from "../src/modules/analytics/analytics.service.js";
import { runScript } from "./_bootstrap.js";

runScript("stats:rebuild", async () => {
  const id = process.argv[2];
  const ids = id ? [id] : (await User.find().select("_id").lean()).map((u) => u._id);
  for (const u of ids) await rebuildUserStats(u);
  console.log(`Rebuilt stats for ${ids.length} user(s).`);
});
