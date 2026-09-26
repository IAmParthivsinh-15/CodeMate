// Entry point for SERVICE_ROLE=worker (see src/server.js).
process.env.SERVICE_ROLE ||= "worker";
await import("../server.js");
