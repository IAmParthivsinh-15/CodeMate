import { MongoMemoryServer } from "mongodb-memory-server";

// Starts one throwaway MongoDB for the whole run, unless TEST_MONGO_URL points
// at an existing server. Set MONGOMS_SYSTEM_BINARY to reuse a locally
// installed mongod instead of downloading one.
let server;

export async function setup() {
  if (process.env.TEST_MONGO_URL) return;
  server = await MongoMemoryServer.create();
  process.env.TEST_MONGO_URL = server.getUri();
}

export async function teardown() {
  await server?.stop();
}
