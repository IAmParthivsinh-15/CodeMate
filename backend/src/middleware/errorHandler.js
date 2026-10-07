import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { AppError } from "../shared/errors.js";
import { logger } from "../infrastructure/logger/index.js";
import { isProd } from "../config/env.js";

const translate = (err) => {
  if (err instanceof AppError) return err;
  if (err instanceof mongoose.Error.ValidationError)
    return new AppError("VALIDATION_ERROR", "Validation failed", 400,
      Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })));
  if (err instanceof mongoose.Error.CastError) return new AppError("INVALID_ID", `Invalid ${err.path}`, 400);
  if (err?.code === 11000) return new AppError("DUPLICATE", "A record with this value already exists", 409, err.keyValue ? Object.keys(err.keyValue) : undefined);
  if (err instanceof jwt.TokenExpiredError) return new AppError("TOKEN_EXPIRED", "Token expired", 401);
  if (err instanceof jwt.JsonWebTokenError) return new AppError("TOKEN_INVALID", "Invalid token", 401);
  if (err?.type === "entity.parse.failed") return new AppError("INVALID_JSON", "Malformed JSON body", 400);
  if (err?.type === "entity.too.large") return new AppError("PAYLOAD_TOO_LARGE", "Request body too large", 413);
  return null;
};

 
export const errorHandler = (err, req, res, next) => {
  const known = translate(err);
  const status = known?.status || 500;
  if (status >= 500) logger.error({ err, requestId: req.id, path: req.path }, "Unhandled error");
  const body = {
    success: false,
    error: {
      code: known?.code || "INTERNAL_ERROR",
      message: known?.message || "Internal server error",
      ...(known?.details ? { details: known.details } : {}),
      ...(!isProd && !known ? { stack: err?.stack } : {}),
    },
    message: known?.message || "Internal server error", // legacy clients read body.message
    requestId: req.id,
  };
  res.status(status).json(body);
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "ROUTE_NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
    message: "Route not found",
    requestId: req.id,
  });
};
