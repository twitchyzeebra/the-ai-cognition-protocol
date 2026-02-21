/**
 * Stream Z AI GLM models (GLM-5, GLM-4.7, etc.)
 * Uses OpenAI SDK with custom base URL since GLM API is OpenAI-compatible
 * @param {{ apiKey:string, model:string, prompt:string, history:Array<{role:'user'|'assistant'|'system', content:string}>, systemInstruction?:string, temperature?:number }} params
 */
export async function* sendMessageStream({ apiKey, model, prompt, history, systemInstruction, temperature }) {
  const baseURL = 'https://api.z.ai/api/paas/v4';
  const messages = [];

  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  if (Array.isArray(history)) {
    for (const m of history) {
      if (!m || typeof m.content !== 'string') continue;
      const role = m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user');
      messages.push({ role, content: m.content });
    }
  }
  messages.push({ role: 'user', content: prompt });

  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: typeof temperature === 'number' ? temperature : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GLM API error (${response.status}): ${error}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let yieldedAny = false;
    let usageEmitted = false;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines[lines.length - 1]; // Keep incomplete line

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line || line === ':ok') continue;

        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const chunk = JSON.parse(data);

            // Emit usage when available
            if (chunk.usage && !usageEmitted) {
              usageEmitted = true;
              const pt = chunk.usage.prompt_tokens ?? 0;
              const ct = chunk.usage.completion_tokens ?? 0;
              yield { __usage: { provider: 'glm', model, inputTokens: pt, outputTokens: ct, totalTokens: (pt + ct), method: 'provider' } };
            }

            // Extract text from choices
            const delta = chunk?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              yieldedAny = true;
              yield delta;
            }
          } catch (e) {
            // Skip parsing errors for malformed chunks
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      const data = buffer.trim().slice(6);
      if (data !== '[DONE]') {
        try {
          const chunk = JSON.parse(data);
          if (chunk.usage && !usageEmitted) {
            usageEmitted = true;
            const pt = chunk.usage.prompt_tokens ?? 0;
            const ct = chunk.usage.completion_tokens ?? 0;
            yield { __usage: { provider: 'glm', model, inputTokens: pt, outputTokens: ct, totalTokens: (pt + ct), method: 'provider' } };
          }
          const delta = chunk?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            yieldedAny = true;
            yield delta;
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    if (!yieldedAny) {
      throw new Error(`Provider=glm produced no text. model=${model}`);
    }
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (msg.includes('aborted') || msg.includes('AbortError')) {
      return;
    }
    throw err;
  }
}
