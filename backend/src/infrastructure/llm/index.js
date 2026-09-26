import { env } from "../../config/env.js";
import { childLogger } from "../logger/index.js";
import { metrics } from "../metrics/index.js";
import { openAiCompatibleProvider } from "./providers/openaiCompatible.js";
import { geminiProvider } from "./providers/gemini.js";

const log = childLogger("llm");

// LLM gateway (spec §23). Application code calls llm.generate({ task, ... })
// and never names a vendor. Provider comes from LLM_PROVIDER; the model is
// chosen per task tier (spec §24) and every name is overridable by env.

// Task → tier. Cheap tasks go to the small model.
export const TASK_TIERS = Object.freeze({
  chess_chat: "small",
  game_chat: "medium",
  explain_move: "medium",
  analysis_summary: "medium",
  coach: "large",
});

// Defaults only; set LLM_MODEL / LLM_MODEL_{SMALL,MEDIUM,LARGE} to the models
// your account can use. Provider catalogues change, so check these first.
const DEFAULT_MODELS = {
  groq: { small: "llama-3.1-8b-instant", medium: "llama-3.3-70b-versatile", large: "llama-3.3-70b-versatile" },
  nvidia: { small: "meta/llama-3.1-8b-instruct", medium: "meta/llama-3.3-70b-instruct", large: "meta/llama-3.3-70b-instruct" },
  gemini: { small: "gemini-2.5-flash", medium: "gemini-2.5-flash", large: "gemini-2.5-pro" },
};

export class LlmUnavailableError extends Error {
  constructor(message = "No LLM provider configured") {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

function buildProvider(name) {
  switch (name) {
    case "groq":
      return openAiCompatibleProvider({ name, baseUrl: "https://api.groq.com/openai/v1", apiKey: env.GROQ_API_KEY, supportsJsonMode: true });
    case "nvidia":
      return openAiCompatibleProvider({ name, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: env.NVIDIA_API_KEY, supportsJsonMode: false });
    case "gemini":
      return geminiProvider({ apiKey: env.GEMINI_API_KEY });
    default:
      return null;
  }
}

export function modelFor(task, providerName = env.LLM_PROVIDER) {
  const tier = TASK_TIERS[task] || "medium";
  const override = { small: env.LLM_MODEL_SMALL, medium: env.LLM_MODEL_MEDIUM, large: env.LLM_MODEL_LARGE }[tier];
  return override || env.LLM_MODEL || DEFAULT_MODELS[providerName]?.[tier];
}

// Pull the first JSON object out of a model reply (tolerates ```json fences).
export function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(text.slice(start, end + 1));
}

let provider;
const current = () => (provider === undefined ? (provider = buildProvider(env.LLM_PROVIDER)) : provider);

export const llm = {
  get enabled() { return !!current(); },
  get providerName() { return current()?.name || "none"; },

  /**
   * @param {{task:string, system?:string, messages:{role:string,content:string}[], json?:boolean,
   *          schema?: import("zod").ZodTypeAny, temperature?:number, maxTokens?:number}} req
   * @returns {Promise<{text:string, data?:any, provider:string, model:string, usage:object}>}
   */
  async generate({ task, system, messages, json = false, schema, temperature, maxTokens }) {
    const p = current();
    if (!p) throw new LlmUnavailableError();
    const model = modelFor(task, p.name);
    const labels = { provider: p.name, task };
    const end = metrics.llmDuration.startTimer(labels);
    let lastErr;
    // One retry, used when JSON output fails validation.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await p.generate({ model, system, messages, json, temperature, maxTokens, timeoutMs: env.LLM_TIMEOUT_MS });
        metrics.llmTokens.inc({ provider: p.name, type: "input" }, out.usage.input);
        metrics.llmTokens.inc({ provider: p.name, type: "output" }, out.usage.output);
        let data;
        if (json) {
          data = extractJson(out.text);
          if (schema) data = schema.parse(data); // spec §59: validate before use
        }
        end();
        return { text: out.text, data, provider: p.name, model, usage: out.usage };
      } catch (err) {
        lastErr = err;
        const isHttp = /^\w+ \d{3}:/.test(err.message);
        log.warn({ err: err.message, task, attempt }, "LLM call failed");
        if (isHttp || err.name === "TimeoutError" || !json) break; // only retry bad JSON
      }
    }
    end();
    metrics.llmErrors.inc(labels);
    throw lastErr;
  },
};

// Test hook: swap the provider (e.g. a fake that returns canned JSON).
export const __setProvider = (p) => { provider = p; };
