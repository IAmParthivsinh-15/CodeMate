// Entry point for SERVICE_ROLE=realtime (see src/server.js).
process.env.SERVICE_ROLE ||= "realtime";
await import("../server.js");
