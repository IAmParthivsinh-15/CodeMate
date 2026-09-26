import User from "../modules/users/user.model.js";
import Admin from "../modules/admin/admin.model.js";
import { verifyAccessToken, tokenFromRequest } from "../modules/auth/tokens.js";
import jwt from "jsonwebtoken";
import { unauthorized } from "../shared/errors.js";

// jsonwebtoken errors carry no code; give sockets (no errorHandler there) the same codes as REST.
function verify(token) {
  try {
    return verifyAccessToken(token);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw unauthorized("Token expired", "TOKEN_EXPIRED");
    throw unauthorized("Invalid token", "TOKEN_INVALID");
  }
}

// Resolve the user for an access token. Tokens issued before the typ claim
// existed have no typ and are accepted by both guards; the collection lookup
// still keeps users and admins apart.
export async function userFromToken(token) {
  if (!token) throw unauthorized("Not authorized, no token", "NO_TOKEN");
  const decoded = verify(token);
  if (decoded.typ && decoded.typ !== "user") throw unauthorized("Wrong token type", "TOKEN_INVALID");
  const user = await User.findById(decoded.userId).select("-refreshTokens -submissions");
  if (!user) throw unauthorized("User not found", "USER_NOT_FOUND");
  return user;
}

export const protectRoutes = async (req, res, next) => {
  req.user = await userFromToken(tokenFromRequest(req));
  next();
};

// Attaches req.user when a valid token is present, otherwise continues anonymously.
export const optionalAuth = async (req, res, next) => {
  const token = tokenFromRequest(req);
  if (token) {
    try {
      req.user = await userFromToken(token);
    } catch {
      // invalid token: treat as anonymous
    }
  }
  next();
};

export const protectAdminRoutes = async (req, res, next) => {
  const token = tokenFromRequest(req);
  if (!token) throw unauthorized("Not authorized, no token", "NO_TOKEN");
  const decoded = verify(token);
  if (decoded.typ && decoded.typ !== "admin") throw unauthorized("Not authorized as admin", "NOT_ADMIN");
  const admin = await Admin.findById(decoded.userId);
  if (!admin) throw unauthorized("Not authorized as admin", "NOT_ADMIN");
  req.user = admin;
  next();
};
