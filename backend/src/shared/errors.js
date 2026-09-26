// Application errors carry a stable machine-readable code (spec §52).
// Throw these from controllers/services; middleware/errorHandler.js formats them.
export class AppError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details, code = "BAD_REQUEST") => new AppError(code, message, 400, details);
export const unauthorized = (message = "Not authorized", code = "UNAUTHORIZED") => new AppError(code, message, 401);
export const forbidden = (message = "Forbidden", code = "FORBIDDEN") => new AppError(code, message, 403);
export const notFound = (what = "Resource", code) =>
  new AppError(code || `${what.toUpperCase().replace(/\s+/g, "_")}_NOT_FOUND`, `${what} not found`, 404);
export const conflict = (message, code = "CONFLICT") => new AppError(code, message, 409);
export const tooMany = (message = "Too many requests", code = "RATE_LIMITED") => new AppError(code, message, 429);
export const unavailable = (message, code = "SERVICE_UNAVAILABLE") => new AppError(code, message, 503);
