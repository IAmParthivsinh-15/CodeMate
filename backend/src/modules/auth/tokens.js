import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { env, isProd } from "../../config/env.js";

// "15m" / "7d" / "3600" → milliseconds (same units jsonwebtoken accepts).
export function durationMs(value) {
  const m = String(value).trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/);
  if (!m) throw new Error(`Invalid duration: ${value}`);
  const n = Number(m[1]);
  const unit = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2] || "s"];
  return n * unit;
}

const cookieBase = { httpOnly: true, sameSite: "strict", secure: isProd, path: "/" };

// typ distinguishes user and admin tokens, which share a signing secret.
// jwtid makes every token unique: without it, two tokens issued in the same
// second are identical and refresh-token rotation silently does nothing.
const sign = (userId, typ, secret, expiresIn) => jwt.sign({ userId: String(userId), typ }, secret, { expiresIn, jwtid: randomUUID() });

export const genToken = (userId, res, typ = "user") => {
  const token = sign(userId, typ, env.ACCESS_TOKEN_SECRET, env.ACCESS_TOKEN_EXPIRES_IN);
  res?.cookie("jwt", token, { ...cookieBase, maxAge: durationMs(env.ACCESS_TOKEN_EXPIRES_IN) });
  return token;
};

export const refToken = (userId, res, typ = "user") => {
  const token = sign(userId, typ, env.REFRESH_TOKEN_SECRET, env.REFRESH_TOKEN_EXPIRES_IN);
  res?.cookie("refreshToken", token, { ...cookieBase, maxAge: durationMs(env.REFRESH_TOKEN_EXPIRES_IN) });
  return token;
};

export const refreshExpiryDate = () => new Date(Date.now() + durationMs(env.REFRESH_TOKEN_EXPIRES_IN));

export const verifyAccessToken = (token) => jwt.verify(token, env.ACCESS_TOKEN_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, env.REFRESH_TOKEN_SECRET);

export const clearAuthCookies = (res) => {
  res.clearCookie("jwt", cookieBase);
  res.clearCookie("refreshToken", cookieBase);
};

// Bearer header first, then the httpOnly cookie.
export function tokenFromRequest(req) {
  const header = req.headers?.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.jwt || null;
}

// Minimal cookie parsing for the Socket.IO handshake (no Express there).
export function tokenFromCookieHeader(cookieHeader = "") {
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === "jwt") return decodeURIComponent(v.join("="));
  }
  return null;
}
