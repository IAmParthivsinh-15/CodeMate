// Google Gemini (Generative Language REST API).
export function geminiProvider({ apiKey, baseUrl = "https://generativelanguage.googleapis.com/v1beta" }) {
  return {
    name: "gemini",
    async generate({ model, system, messages, json, temperature = 0.3, maxTokens = 900, timeoutMs }) {
      const body = {
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      const res = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
      return {
        text,
        usage: { input: data.usageMetadata?.promptTokenCount ?? 0, output: data.usageMetadata?.candidatesTokenCount ?? 0 },
      };
    },
  };
}
