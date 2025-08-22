import OpenAI from 'openai';

/**
 * Stream OpenAI Chat Completions
 * @param {{ apiKey:string, model:string, prompt:string, history:Array<{role:'user'|'assistant'|'system', content:string}>, systemInstruction?:string, temperature?:number }} params
 */
export async function* sendMessageStream({ apiKey, model, prompt, history, systemInstruction, temperature }) {
  const client = new OpenAI({ apiKey });
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
    const stream = await client.chat.completions.create({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: typeof temperature === 'number' ? temperature : undefined,
    });

    let yieldedAny = false;
    let usageEmitted = false;
    for await (const part of stream) {
      // Emit provider usage if present (requires stream_options.include_usage)
      const u = part && part.usage;
      if (u && !usageEmitted) {
        usageEmitted = true;
        const pt = u.prompt_tokens ?? u.input_tokens ?? 0;
        const ct = u.completion_tokens ?? u.output_tokens ?? 0;
        const tt = u.total_tokens ?? (pt + ct);
        yield { __usage: { provider: 'openai', model, inputTokens: pt, outputTokens: ct, totalTokens: tt, method: 'provider' } };
      }
      const delta = part?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length) {
        yieldedAny = true;
        yield delta;
      }
    }
    if (!yieldedAny) {
      throw new Error(`Provider=openai produced no text. model=${model}`);
    }
  } catch (err) {
    const msg = String(err?.message || err || '');
    // Allow caller to handle abort/connection errors gracefully
    if (msg.includes('aborted') || msg.includes('AbortError')) {
      return;
    }
    throw err;
  }
}
