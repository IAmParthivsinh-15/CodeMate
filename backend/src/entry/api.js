// Entry point for SERVICE_ROLE=api (see src/server.js).
process.env.SERVICE_ROLE ||= "api";
await import("../server.js");
