import { forbidden, unauthorized } from "../shared/errors.js";

const checkRole = (roles) => (req, res, next) => {
  if (!req.user) throw unauthorized("Not authenticated");
  if (!roles.includes(req.user.role)) throw forbidden(`Access denied. Required role: ${roles.join(" or ")}`);
  next();
};

export default checkRole;
