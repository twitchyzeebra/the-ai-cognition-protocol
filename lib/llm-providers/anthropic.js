import Anthropic from '@anthropic-ai/sdk';
import { anthropicSupportsSampling, anthropicSupportsEffort } from '../constants';

// Fable / Mythos run safety classifiers that can return stop_reason "refusal".
// Server-side fallbacks re-run the request on another model in the same call.
const FALLBACK_PATTERN = /claude-(fable|mythos|opus-5)/i;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const refusalMessage = (d) =>
  `The model declined this request${d?.category ? ` (${d.category})` : ''}${d?.explanation ? `: ${d.explanation}` : '.'}`;

const friendlyError = (err) => {
  if (err instanceof Anthropic.AuthenticationError) return new Error('Anthropic rejected the API key. Check Settings.');
  if (err instanceof Anthropic.RateLimitError) return new Error('Anthropic rate limit hit. Wait a moment and retry.');
  if (err instanceof Anthropic.BadRequestError) return new Error(`Anthropic rejected the request: ${err.message}`);
  return err;
};

/** Stream the Anthropic Messages API. See app/api/chat/route.js for the adapter contract. */
export async function* sendMessageStream({ apiKey, model, prompt, history, systemInstruction, temperature, effort, images, signal }) {
  const content = images?.length
    ? [...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.data } })), { type: 'text', text: prompt }]
    : prompt;
  const params = { model, system: systemInstruction || undefined, messages: [...history, { role: 'user', content }], max_tokens: 64000, stream: true };
  if (typeof temperature === 'number' && anthropicSupportsSampling(model)) params.temperature = temperature;
  if (effort && anthropicSupportsEffort(model)) params.output_config = { effort };
  const useFallbacks = FALLBACK_PATTERN.test(model);
  if (useFallbacks) Object.assign(params, { betas: [FALLBACK_BETA], fallbacks: 'default' });

  const client = new Anthropic({ apiKey });
  let yielded = false, stopReason, stopDetails, servedBy = model, inputTokens = 0, outputTokens = 0;
  try {
    const stream = await (useFallbacks ? client.beta.messages : client.messages).create(params, { signal });
    for await (const event of stream) {
      if (event.type === 'message_start') {
        if (event.message?.usage?.input_tokens != null) inputTokens = Number(event.message.usage.input_tokens) || 0;
        if (event.message?.model) servedBy = event.message.model;
      } else if (event.type === 'message_delta') {
        if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
        if (event.delta?.stop_details) stopDetails = event.delta.stop_details;
        // Cumulative usage rides on the event itself, not on delta.
        const u = event.usage || event.delta?.usage;
        if (u?.output_tokens != null) outputTokens = Number(u.output_tokens) || outputTokens;
        if (u?.input_tokens != null) inputTokens = Number(u.input_tokens) || inputTokens;
      } else if (event.type === 'content_block_start' && event.content_block?.type === 'fallback') {
        if (event.content_block.to?.model) servedBy = event.content_block.to.model;
      } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
        // Only text deltas reach the user; thinking deltas carry no text on Fable-class models.
        yielded = true;
        yield event.delta.text;
      }
    }
  } catch (err) {
    throw friendlyError(err);
  }

  if (inputTokens || outputTokens) {
    yield { __usage: { provider: 'anthropic', model: servedBy, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, method: 'provider' } };
  }
  if (servedBy !== model) yield { __notice: `Served by ${servedBy} (fallback after ${model} declined).` };
  if (stopReason === 'refusal') throw new Error(refusalMessage(stopDetails));
  if (!yielded) throw new Error(`Provider=anthropic produced no text. model=${model}, stop=${stopReason ?? 'unknown'}`);
}
