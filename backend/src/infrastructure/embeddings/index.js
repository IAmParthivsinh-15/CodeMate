import { env } from "../../config/env.js";
import { embedLocal, LOCAL_DIM, LOCAL_MODEL_ID } from "./localEmbedder.js";

// Embedding abstraction. `local` needs no network; `gemini` / `nvidia` call
// the provider's embedding API. Changing EMBEDDING_PROVIDER/EMBEDDING_MODEL
// changes modelId, which makes the ingestion pipeline re-embed the corpus.

const remote = {
  gemini: {
    model: () => env.EMBEDDING_MODEL || "text-embedding-004",
    dim: 768,
    async embed(texts, kind) {
      const model = this.model();
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          requests: texts.map((t) => ({
            model: `models/${model}`,
            content: { parts: [{ text: t }] },
            taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
          })),
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`gemini embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return (await res.json()).embeddings.map((e) => e.values);
    },
  },
  nvidia: {
    model: () => env.EMBEDDING_MODEL || "nvidia/nv-embedqa-e5-v5",
    dim: 1024,
    async embed(texts, kind) {
      const res = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.NVIDIA_API_KEY}` },
        body: JSON.stringify({ model: this.model(), input: texts, input_type: kind === "query" ? "query" : "passage", encoding_format: "float" }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`nvidia embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return (await res.json()).data.map((d) => d.embedding);
    },
  },
};

export const embeddings = {
  get modelId() {
    return env.EMBEDDING_PROVIDER === "local" ? LOCAL_MODEL_ID : `${env.EMBEDDING_PROVIDER}:${remote[env.EMBEDDING_PROVIDER].model()}`;
  },
  get dimension() {
    return env.EMBEDDING_PROVIDER === "local" ? LOCAL_DIM : remote[env.EMBEDDING_PROVIDER].dim;
  },
  async embedDocuments(texts) {
    if (env.EMBEDDING_PROVIDER === "local") return texts.map((t) => embedLocal(t));
    const out = [];
    for (let i = 0; i < texts.length; i += 64) out.push(...(await remote[env.EMBEDDING_PROVIDER].embed(texts.slice(i, i + 64), "document")));
    return out;
  },
  async embedQuery(text) {
    if (env.EMBEDDING_PROVIDER === "local") return embedLocal(text);
    return (await remote[env.EMBEDDING_PROVIDER].embed([text], "query"))[0];
  },
};
