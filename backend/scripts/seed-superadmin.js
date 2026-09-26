// Creates the first superadmin (add-admin requires an existing superadmin).
// Usage: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... [SEED_ADMIN_USERNAME=...] npm run seed:admin
import bcrypt from "bcrypt";
import Admin from "../src/modules/admin/admin.model.js";
import { runScript } from "./_bootstrap.js";

runScript("seed:admin", async () => {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const username = process.env.SEED_ADMIN_USERNAME || "superadmin";
  if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");
  if (password.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters");
  if (await Admin.exists({ role: "superadmin" })) {
    console.log("A superadmin already exists; nothing to do.");
    return;
  }
  await Admin.create({ username, email, password: await bcrypt.hash(password, 12), role: "superadmin" });
  console.log(`Created superadmin ${email}`);
});
