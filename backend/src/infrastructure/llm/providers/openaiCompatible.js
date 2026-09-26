// Groq and NVIDIA NIM both expose the OpenAI chat-completions API.
export function openAiCompatibleProvider({ name, baseUrl, apiKey, supportsJsonMode }) {
  return {
    name,
    async generate({ model, system, messages, json, temperature = 0.3, maxTokens = 900, timeoutMs }) {
      const body = {
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [...(system ? [{ role: "system", content: system }] : []), ...messages],
      };
      if (json && supportsJsonMode) body.response_format = { type: "json_object" };
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`${name} ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      return {
        text: data.choices?.[0]?.message?.content ?? "",
        usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
      };
    },
  };
}
