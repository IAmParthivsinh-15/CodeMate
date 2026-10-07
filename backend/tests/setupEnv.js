// Runs before every test file, before the app's modules are imported, so
// config/env.js sees a complete test configuration with every optional
// backend (Redis, Kafka, Qdrant, LLM, Judge0) in its in-process mode.
process.env.NODE_ENV = "test";
process.env.MONGO_URL = process.env.TEST_MONGO_URL || "mongodb://127.0.0.1:27017/codemate_test";
process.env.ACCESS_TOKEN_SECRET = "test-access-secret-0123456789";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-0123456789";
process.env.REDIS_URL = "";
process.env.KAFKA_BROKERS = "";
process.env.VECTOR_DB_URL = "";
process.env.LLM_PROVIDER = "none";
process.env.EMBEDDING_PROVIDER = "local";
process.env.JUDGE0_API_URL = "https://judge0.test";
process.env.JUDGE0_API_KEY = "test-key";
process.env.ANALYSIS_DEPTH = "8"; // fast engine analysis in tests
process.env.ENGINE_POOL_SIZE = "2";
process.env.METRICS_ENABLED = "false";
