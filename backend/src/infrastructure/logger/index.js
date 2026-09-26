import pino from "pino";
import { env, isProd, isTest } from "../../config/env.js";

// Structured JSON logs in production; human-readable output in development.
export const logger = pino({
  level: isTest ? "silent" : env.LOG_LEVEL,
  base: { service: `codemate-${env.SERVICE_ROLE}` },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.refreshToken",
      "*.token",
    ],
    censor: "[redacted]",
  },
  transport: !isProd && !isTest ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } : undefined,
});

export const childLogger = (name) => logger.child({ module: name });
