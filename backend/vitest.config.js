import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/globalSetup.js"],
    setupFiles: ["./tests/setupEnv.js"],
    // Integration suites share one MongoDB server; each file uses its own database.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
