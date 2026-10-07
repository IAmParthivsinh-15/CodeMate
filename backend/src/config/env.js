import "dotenv/config";
import { z } from "zod";

// Every environment variable the backend reads is declared here. Nothing else
// in src/ should touch process.env directly. Optional infrastructure (Redis,
// Kafka, Qdrant, LLM providers) falls back to an in-process implementation
// when its variable is empty, so a fresh clone runs with only MONGO_URL and
// the two JWT secrets set.

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const bool = (def) =>
  z
    .enum(["true", "false", "1", "0", ""])
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : v === "true" || v === "1"));

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5050),
  // Which parts of the system this process runs: see docs/architecture/service-boundaries.md
  SERVICE_ROLE: z.enum(["all", "api", "realtime", "worker"]).default("all"),
  WORKERS: csv, // worker names to run when SERVICE_ROLE is worker/all; empty = all
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGINS: csv,
  ENABLE_DEBUG_ROUTES: bool(false),
  METRICS_ENABLED: bool(true),

  MONGO_URL: z.string().min(1, "MONGO_URL is required"),

  ACCESS_TOKEN_SECRET: z.string().min(16, "ACCESS_TOKEN_SECRET must be at least 16 characters"),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_SECRET: z.string().min(16, "REFRESH_TOKEN_SECRET must be at least 16 characters"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),

  STOCKFISH_PATH: optionalString,
  ENGINE_POOL_SIZE: z.coerce.number().int().min(1).max(16).default(2),
  ANALYSIS_DEPTH: z.coerce.number().int().min(6).max(30).default(14),
  AUTO_ANALYZE: bool(true), // analyse every finished game in the background (spec §28)

  REDIS_URL: optionalString,
  KAFKA_BROKERS: csv,
  KAFKA_CLIENT_ID: z.string().default("codemate"),
  VECTOR_DB_URL: optionalString,
  VECTOR_DB_API_KEY: optionalString,

  LLM_PROVIDER: z.enum(["none", "groq", "nvidia", "gemini"]).default("none"),
  LLM_MODEL: optionalString, // default model for the chosen provider
  LLM_MODEL_SMALL: optionalString, // task routing overrides (spec §24)
  LLM_MODEL_MEDIUM: optionalString,
  LLM_MODEL_LARGE: optionalString,
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  GROQ_API_KEY: optionalString,
  NVIDIA_API_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  EMBEDDING_PROVIDER: z.enum(["local", "gemini", "nvidia"]).default("local"),
  EMBEDDING_MODEL: optionalString,

  JUDGE0_API_URL: optionalString,
  JUDGE0_API_KEY: optionalString,
  // Set for the RapidAPI-hosted Judge0; leave empty for a self-hosted instance.
  JUDGE0_RAPIDAPI_HOST: optionalString,
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    // Logger depends on env, so this one message goes straight to stderr.
    console.error(`Invalid environment configuration:\n${lines.join("\n")}\nSee backend/.env.example.`);
    process.exit(1);
  }
  const env = parsed.data;

  const providerKey = { groq: env.GROQ_API_KEY, nvidia: env.NVIDIA_API_KEY, gemini: env.GEMINI_API_KEY };
  if (env.LLM_PROVIDER !== "none" && !providerKey[env.LLM_PROVIDER]) {
    console.error(`LLM_PROVIDER=${env.LLM_PROVIDER} but ${env.LLM_PROVIDER.toUpperCase()}_API_KEY is empty.`);
    process.exit(1);
  }
  if (env.EMBEDDING_PROVIDER !== "local" && !providerKey[env.EMBEDDING_PROVIDER]) {
    console.error(`EMBEDDING_PROVIDER=${env.EMBEDDING_PROVIDER} but its API key is empty.`);
    process.exit(1);
  }
  return Object.freeze(env);
}

export const env = load();
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
