import { readSSE } from '../sse';
import { openaiSupportsEffort } from '../constants';

// Chat Completions APIs that share OpenAI's streaming format.
const APIS = {
  openai: { label: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions', streamUsage: true, effort: openaiSupportsEffort },
  mistral: { label: 'Mistral', url: 'https://api.mistral.ai/v1/chat/completions', effort: () => false },
  glm: { label: 'GLM', url: 'https://api.z.ai/api/paas/v4/chat/completions', effort: () => true },
};
const RETRY_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

const wait = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});

// POST with up to two retries on transient failures. Nothing has streamed yet, so retrying is safe.
async function post(url, init, signal) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...init, signal });
      if (res.ok || attempt >= 2 || !RETRY_STATUS.has(res.status)) return res;
      await res.body?.cancel().catch(() => {});
    } catch (err) {
      if (signal?.aborted || attempt >= 2) throw err;
    }
    await wait(1000 * 2 ** attempt, signal);
  }
}

/** Adapter factory for 'openai' | 'mistral' | 'glm'. See app/api/chat/route.js for the adapter contract. */
export const openaiCompatible = (provider) => async function* sendMessageStream({ apiKey, model, prompt, history, systemInstruction, temperature, effort, images, signal }) {
  const api = APIS[provider];
  const content = images?.length
    ? [...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } })), { type: 'text', text: prompt }]
    : prompt;
  const body = {
    model,
    messages: [...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []), ...history, { role: 'user', content }],
    stream: true,
  };
  if (api.streamUsage) body.stream_options = { include_usage: true };
  if (typeof temperature === 'number') body.temperature = temperature;
  if (effort && api.effort(model)) body.reasoning_effort = effort;

  const res = await post(api.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  }, signal);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try { detail = JSON.parse(text).error?.message || text; } catch { /* not JSON */ }
    throw new Error(`${api.label} API error ${res.status}: ${detail || res.statusText}`);
  }

  let yielded = false;
  let usageSent = false;
  for await (const data of readSSE(res.body)) {
    if (data === '[DONE]') continue;
    let chunk;
    try { chunk = JSON.parse(data); } catch { continue; }
    if (chunk.usage && !usageSent) {
      usageSent = true;
      const inputTokens = chunk.usage.prompt_tokens ?? 0;
      const outputTokens = chunk.usage.completion_tokens ?? 0;
      yield { __usage: { provider, model, inputTokens, outputTokens, totalTokens: chunk.usage.total_tokens ?? inputTokens + outputTokens, method: 'provider' } };
    }
    const delta = chunk.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta) {
      yielded = true;
      yield delta;
    }
  }
  if (!yielded) throw new Error(`Provider=${provider} produced no text. model=${model}`);
};
