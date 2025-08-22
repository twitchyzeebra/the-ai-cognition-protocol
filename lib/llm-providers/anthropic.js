import Anthropic from '@anthropic-ai/sdk';

/**
 * Stream Anthropic Messages API
 * @param {{ apiKey:string, model:string, prompt:string, history:Array<{role:'user'|'assistant'|'system', content:string}>, systemInstruction?:string, temperature?:number }} params
 */
export async function* sendMessageStream({ apiKey, model, prompt, history, systemInstruction, temperature }) {
  const client = new Anthropic({ apiKey });

  // Anthropic supports a system string and an array of messages with role user/assistant
  const messages = [];
  if (Array.isArray(history)) {
    for (const m of history) {
      if (!m || typeof m.content !== 'string') continue;
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      messages.push({ role, content: m.content });
    }
  }
  messages.push({ role: 'user', content: prompt });

  try {
    const stream = await client.messages.create({
      model,
      system: systemInstruction,
      messages,
      stream: true,
      temperature: typeof temperature === 'number' ? temperature : undefined,
      // max_tokens can be tuned later
    });
  
    let yieldedAny = false;
    let lastStopReason = undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    for await (const event of stream) {
      // Capture stop reasons if provided
      if (event.type === 'message_delta' && event.delta?.stop_reason) {
        lastStopReason = event.delta.stop_reason;
      }
      if (event.type === 'message_stop' && event?.message?.stop_reason) {
        lastStopReason = event.message.stop_reason;
      }
      // Capture usage if provided in stream
      if (event.type === 'message_start' && event.message?.usage?.input_tokens != null) {
        inputTokens = Number(event.message.usage.input_tokens) || inputTokens;
      }
      if (event.type === 'message_delta' && event.delta?.usage?.output_tokens != null) {
        outputTokens = Number(event.delta.usage.output_tokens) || outputTokens;
      }
      if (event.type === 'message_stop' && event.message?.usage) {
        const u = event.message.usage;
        if (u.input_tokens != null) inputTokens = Number(u.input_tokens) || inputTokens;
        if (u.output_tokens != null) outputTokens = Number(u.output_tokens) || outputTokens;
      }
      // We care about content deltas
      if (event.type === 'content_block_delta' && event.delta?.text) {
        yieldedAny = true;
        yield event.delta.text;
      }
    }
    // Emit provider usage if available
    if ((inputTokens || outputTokens)) {
      try {
        yield { __usage: { provider: 'anthropic', model, inputTokens, outputTokens, totalTokens: (inputTokens + outputTokens), method: 'provider' } };
      } catch {}
    }
    if (!yieldedAny) {
      throw new Error(`Provider=anthropic produced no text. model=${model}, stop=${lastStopReason ?? 'unknown'}`);
    }
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (msg.includes('aborted') || msg.includes('AbortError')) {
      return;
    }
    throw err;
  }
}
