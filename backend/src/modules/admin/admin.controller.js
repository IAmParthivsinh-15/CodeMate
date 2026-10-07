import bcrypt from "bcrypt";
import Admin from "./admin.model.js";
import { genToken, refToken } from "../auth/tokens.js";
import { conflict, unauthorized } from "../../shared/errors.js";
import { ok, created } from "../../shared/http.js";

const view = (a) => ({ _id: a._id, username: a.username, email: a.email, role: a.role });

export const loginAdmin = async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email }).select("+password");
  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    throw unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  }
  const token = genToken(admin._id, res, "admin");
  const refreshToken = refToken(admin._id, res, "admin");
  ok(res, { ...view(admin), token, refreshToken });
};

// Route is guarded by checkRole(["superadmin"]).
export const addAdmin = async (req, res) => {
  const { username, email, password, role } = req.body;
  if (await Admin.exists({ email })) throw conflict("Admin already exists", "ADMIN_EXISTS");
  const admin = await Admin.create({ username, email, password: await bcrypt.hash(password, 12), role });
  created(res, { message: "Admin created successfully", admin: view(admin) });
};
