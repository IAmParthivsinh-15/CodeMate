import bcrypt from "bcrypt";
import User from "../users/user.model.js";
import { genToken, refToken, verifyRefreshToken, refreshExpiryDate, clearAuthCookies } from "./tokens.js";
import { badRequest, conflict, unauthorized } from "../../shared/errors.js";
import { ok, created } from "../../shared/http.js";
import { publicUser } from "../users/users.service.js";

const issueSession = async (user, res) => {
  const token = genToken(user._id, res);
  const refreshToken = refToken(user._id, res);
  await user.addRefreshToken(refreshToken, refreshExpiryDate());
  return { token, refreshToken };
};

// Responses keep the legacy top-level _id/username/email fields and add `user`.
export const register = async (req, res) => {
  const { username, email, password } = req.body;
  if (await User.exists({ email })) throw conflict("User already exists", "USER_EXISTS");
  const user = new User({ username, email, password: await bcrypt.hash(password, 12) });
  await user.save();
  const tokens = await issueSession(user, res);
  const profile = publicUser(user);
  created(res, { ...profile, user: profile, ...tokens, message: "User registered successfully" });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  // Same error for unknown email and wrong password: no account enumeration.
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  }
  const tokens = await issueSession(user, res);
  const profile = publicUser(user);
  ok(res, { ...profile, user: profile, ...tokens, message: "User logged in successfully" });
};

export const refreshToken = async (req, res) => {
  const token = req.body?.refreshToken || req.cookies?.refreshToken;
  if (!token) throw unauthorized("Refresh token required", "NO_REFRESH_TOKEN");
  const decoded = verifyRefreshToken(token);
  if (decoded.typ && decoded.typ !== "user") throw unauthorized("Invalid refresh token", "TOKEN_INVALID");
  const user = await User.findById(decoded.userId);
  if (!user || !user.hasRefreshToken(token)) throw unauthorized("Invalid refresh token", "TOKEN_INVALID");
  await user.removeRefreshToken(token);
  const tokens = await issueSession(user, res);
  ok(res, { accessToken: tokens.token, token: tokens.token, refreshToken: tokens.refreshToken });
};

export const logout = async (req, res) => {
  const token = req.body?.refreshToken || req.cookies?.refreshToken;
  if (token) {
    try {
      const decoded = verifyRefreshToken(token);
      const user = await User.findById(decoded.userId);
      if (user) await user.removeRefreshToken(token);
    } catch {
      // An expired or invalid token still ends with a logged-out client.
    }
  } else if (!req.cookies?.jwt) {
    throw badRequest("Refresh token is required", undefined, "NO_REFRESH_TOKEN");
  }
  clearAuthCookies(res);
  ok(res, { message: "Logged out successfully" });
};

export const getUserProfile = async (req, res) => {
  const profile = publicUser(req.user);
  ok(res, { ...profile, user: profile, message: "User profile retrieved successfully" });
};
