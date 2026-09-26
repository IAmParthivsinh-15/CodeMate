import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env, isProd } from "./config/env.js";
import { logger } from "./infrastructure/logger/index.js";
import { metrics } from "./infrastructure/metrics/index.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { limiters } from "./middleware/rateLimit.js";
import routes from "./routes/index.js";

// Builds the Express app without listening, so tests can drive it with supertest.
export function createApp() {
  const app = express();
  app.set("trust proxy", 1); // behind nginx / ingress: req.ip is the client
  app.disable("x-powered-by");

  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => req.id, autoLogging: { ignore: (req) => ["/health", "/ready", "/metrics"].includes(req.url) } }));
  app.use(helmet());
  app.use(
    cors({
      // In development any origin is allowed; set CORS_ORIGINS in production.
      origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : !isProd,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());

  // HTTP latency/error metrics per route pattern (not per raw URL: bounded cardinality).
  app.use((req, res, next) => {
    const end = metrics.httpDuration.startTimer();
    res.on("finish", () => {
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.baseUrl || "unmatched";
      end({ method: req.method, route, status: res.statusCode });
      if (res.statusCode >= 500) metrics.httpErrors.inc({ method: req.method, route });
    });
    next();
  });

  app.use("/api", limiters.general);
  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
