import Anthropic from '@anthropic-ai/sdk';

// Models from Claude 4.6 onward reject sampling params (temperature/top_p/top_k) with a 400.
// Haiku 4.5 and older still accept them.
const NO_SAMPLING_PATTERN = /claude-(fable|mythos|opus-5|opus-4-[678]|sonnet-5|sonnet-4-6)/i;
export const supportsSampling = (model) => !NO_SAMPLING_PATTERN.test(model || '');

// output_config.effort exists on Opus 4.5+ / Sonnet 5 / Fable; older models 400 on it.
const EFFORT_PATTERN = /claude-(fable|mythos|opus-5|opus-4-[5678]|sonnet-5|sonnet-4-6)/i;
export const supportsEffort = (model) => EFFORT_PATTERN.test(model || '');

// Fable / Mythos run safety classifiers that can return stop_reason "refusal".
// Server-side fallbacks re-run the request on another model in the same call.
const FALLBACK_PATTERN = /claude-(fable|mythos|opus-5)/i;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const REFUSAL_MESSAGE = (details) => {
  const cat = details?.category ? ` (${details.category})` : '';
  const why = details?.explanation ? `: ${details.explanation}` : '.';
  return `The model declined this request${cat}${why}`;
};

/**
 * Stream Anthropic Messages API
 * @param {{ apiKey:string, model:string, prompt:string, history:Array<{role:'user'|'assistant', content:string}>,
 *   systemInstruction?:string, temperature?:number, maxTokens?:number, effort?:string,
 *   images?:Array<{mimeType:string,data:string}> }} params
 */
export async function* sendMessageStream({ apiKey, model, prompt, history, systemInstruction, temperature, maxTokens, effort, images }) {
  const client = new Anthropic({ apiKey });

  const messages = [];
  if (Array.isArray(history)) {
    for (const m of history) {
      if (!m || typeof m.content !== 'string') continue;
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      // Empty assistant turns (user pressed Stop early) are rejected by the API.
      const content = role === 'assistant' && !m.content.trim() ? '[empty message]' : m.content;
      messages.push({ role, content });
    }
  }

  if (Array.isArray(images) && images.length > 0) {
    messages.push({
      role: 'user',
      content: [
        ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.data } })),
        { type: 'text', text: prompt }
      ]
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const params = {
    model,
    system: systemInstruction || undefined,
    messages,
    max_tokens: maxTokens || 64000,
    stream: true
  };
  if (typeof temperature === 'number' && supportsSampling(model)) params.temperature = temperature;
  if (effort && supportsEffort(model)) params.output_config = { effort };

  const useFallbacks = FALLBACK_PATTERN.test(model);
  if (useFallbacks) {
    params.betas = [FALLBACK_BETA];
    params.fallbacks = 'default';
  }

  try {
    const stream = useFallbacks
      ? await client.beta.messages.create(params)
      : await client.messages.create(params);

    let yieldedAny = false;
    let stopReason;
    let stopDetails;
    let servedBy = model;
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream) {
      if (event.type === 'message_start' && event.message) {
        if (event.message.usage?.input_tokens != null) inputTokens = Number(event.message.usage.input_tokens) || 0;
        if (event.message.model) servedBy = event.message.model;
      }
      if (event.type === 'message_delta') {
        if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
        if (event.delta?.stop_details) stopDetails = event.delta.stop_details;
        // Cumulative usage rides on the event itself, not on delta.
        const u = event.usage || event.delta?.usage;
        if (u?.output_tokens != null) outputTokens = Number(u.output_tokens) || outputTokens;
        if (u?.input_tokens != null) inputTokens = Number(u.input_tokens) || inputTokens;
      }
      if (event.type === 'content_block_start' && event.content_block?.type === 'fallback') {
        const to = event.content_block?.to?.model;
        if (to) servedBy = to;
      }
      // Only text deltas reach the user; thinking deltas carry no text on Fable-class models.
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
        yieldedAny = true;
        yield event.delta.text;
      }
    }

    if (inputTokens || outputTokens) {
      yield { __usage: { provider: 'anthropic', model: servedBy, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, method: 'provider' } };
    }
    if (servedBy && servedBy !== model) {
      yield { __notice: `Served by ${servedBy} (fallback after ${model} declined).` };
    }

    if (stopReason === 'refusal') {
      throw new Error(REFUSAL_MESSAGE(stopDetails));
    }
    if (!yieldedAny) {
      throw new Error(`Provider=anthropic produced no text. model=${model}, stop=${stopReason ?? 'unknown'}`);
    }
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (msg.includes('aborted') || msg.includes('AbortError')) return;
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Anthropic rejected the API key. Check Settings.');
    if (err instanceof Anthropic.RateLimitError) throw new Error('Anthropic rate limit hit. Wait a moment and retry.');
    if (err instanceof Anthropic.BadRequestError) throw new Error(`Anthropic rejected the request: ${err.message}`);
    throw err;
  }
}
