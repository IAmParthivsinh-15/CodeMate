// Runs the Chess Knowledge ingestion pipeline (spec §19). Only changed chunks
// are embedded. Usage: npm run ingest [-- --force]
import { ingestCorpus } from "../src/modules/ai/rag/ingest.js";
import { runScript } from "./_bootstrap.js";

runScript("ingest", async () => {
  const stats = await ingestCorpus({ force: process.argv.includes("--force") });
  console.log(JSON.stringify(stats, null, 2));
});
