import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import * as google from '../../../lib/llm-providers/google';
import * as anthropic from '../../../lib/llm-providers/anthropic';
import { openaiCompatible } from '../../../lib/llm-providers/openai-compatible';
import {
    DEFAULT_MODELS, VALIDATION_LIMITS as LIMITS, DEV_KEY_PROVIDER, DEV_KEY_MODEL, EFFORT_LEVELS,
    isCustomPromptSelection, maxTemperature
} from '../../../lib/constants';

// Adapter contract: async generator taking { apiKey, model, prompt, history, systemInstruction,
// temperature?, effort?, images?, signal } and yielding text chunks, plus optional
// { __usage: { inputTokens, outputTokens, totalTokens, model } } and { __notice: string } objects.
// It must stop when `signal` aborts (client disconnected) and throw on failure.
const ADAPTERS = {
    google: google.sendMessageStream,
    anthropic: anthropic.sendMessageStream,
    openai: openaiCompatible('openai'),
    mistral: openaiCompatible('mistral'),
    glm: openaiCompatible('glm')
};

const FALLBACK_PROMPT = 'You are a helpful AI assistant.';
const PROMPT_DIR = path.join(process.cwd(), 'SystemPrompts', 'Encrypted');

const jsonError = (error, status = 400) => Response.json({ error }, { status });
const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** Decrypts SystemPrompts/Encrypted/<name>.json (AES-256-GCM, key in SYSTEM_PROMPT_KEY). */
function loadSystemPrompt(name) {
    // Prompt names are bare file names; anything else is a path traversal attempt.
    if (typeof name !== 'string' || !name || path.basename(name) !== name) {
        console.warn(`Rejected system prompt name: ${JSON.stringify(name)}`);
        return FALLBACK_PROMPT;
    }
    try {
        const key = process.env.SYSTEM_PROMPT_KEY?.trim();
        if (!/^[a-f0-9]{64}$/i.test(key || '')) throw new Error('SYSTEM_PROMPT_KEY is missing or not 64 hex characters');
        const { iv, authTag, encrypted } = JSON.parse(fs.readFileSync(path.join(PROMPT_DIR, `${name}.json`), 'utf8'));
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        return Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8');
    } catch (error) {
        console.error(`System prompt "${name}" unavailable (${error.code || error.message}); using fallback.`);
        return FALLBACK_PROMPT;
    }
}

export async function POST(req) {
    let body;
    try {
        body = (await req.json()) || {};
    } catch {
        return jsonError('Invalid JSON request body');
    }
    try {
        const { prompt, systemPrompt, customPrompt, effort } = body;
        const history = Array.isArray(body.history) ? body.history : [];
        const images = Array.isArray(body.images) ? body.images : [];
        const useDeveloperKey = !!body.useDeveloperKey;

        // Developer key always routes to the configured Anthropic model; the client
        // cannot pick a different provider/model on the server's key.
        const provider = useDeveloperKey ? DEV_KEY_PROVIDER : (text(body.provider) || 'google').toLowerCase();
        const apiKey = text(useDeveloperKey ? process.env.ANTHROPIC_API_KEY : body.apiKey);
        const model = useDeveloperKey ? DEV_KEY_MODEL : text(body.model) || DEFAULT_MODELS[provider]?.[0];

        if (typeof prompt !== 'string' || !prompt.trim()) return jsonError('Invalid prompt');
        if (prompt.length > LIMITS.MAX_PROMPT_LENGTH) return jsonError(`Prompt too long. Maximum ${LIMITS.MAX_PROMPT_LENGTH} characters allowed.`, 413);
        if (apiKey.length > LIMITS.MAX_API_KEY_LENGTH) return jsonError('API key too long', 413);

        // Blank assistant turns (Stop pressed before any text) are rejected by several providers.
        const messages = history.map(m => {
            const role = m?.role === 'user' ? 'user' : 'assistant';
            const content = typeof m?.content === 'string' ? m.content : '';
            return { role, content: role === 'assistant' && !content.trim() ? '[empty message]' : content };
        });
        if (messages.length > LIMITS.MAX_HISTORY_ITEMS) return jsonError(`Too many history items. Maximum ${LIMITS.MAX_HISTORY_ITEMS} messages allowed.`, 413);
        if (messages.reduce((sum, m) => sum + m.content.length, 0) > LIMITS.MAX_HISTORY_TOTAL) {
            return jsonError(`History too long. Maximum ${LIMITS.MAX_HISTORY_TOTAL} characters total allowed.`, 413);
        }

        if (images.length > LIMITS.MAX_IMAGES_PER_MESSAGE) return jsonError(`Too many images. Maximum ${LIMITS.MAX_IMAGES_PER_MESSAGE} per message.`, 413);
        const validImages = images
            .filter(img => img?.mimeType && typeof img.mimeType === 'string' && img.data && typeof img.data === 'string')
            .map(({ mimeType, data }) => ({ mimeType, data }));
        if (validImages.some(img => img.data.length > LIMITS.MAX_IMAGE_BASE64)) return jsonError('Image too large (max 5MB).', 413); // base64 is ~1.33x

        const adapter = ADAPTERS[provider];
        if (!adapter) return jsonError(`Unsupported provider: ${provider}`);
        if (!apiKey) {
            return useDeveloperKey
                ? jsonError('Developer key is not configured on the server (ANTHROPIC_API_KEY missing).', 503)
                : jsonError('Missing API key. Provide your key in Settings.');
        }

        const temp = Number(body.temperature);
        const params = {
            apiKey,
            model,
            prompt,
            history: messages,
            systemInstruction: isCustomPromptSelection(systemPrompt)
                ? (typeof customPrompt === 'string' ? customPrompt : '')
                : loadSystemPrompt(systemPrompt),
            temperature: Number.isFinite(temp) ? Math.min(maxTemperature(provider), Math.max(0, temp)) : undefined,
            effort: EFFORT_LEVELS[provider]?.includes(effort) ? effort : undefined,
            images: validImages.length ? validImages : undefined
        };

        // Aborts when the client disconnects (Stop button, closed tab) so the provider request stops too.
        const abort = new AbortController();
        const signal = req.signal ? AbortSignal.any([req.signal, abort.signal]) : abort.signal;
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                const send = (type, data = {}) => {
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
                    } catch {
                        abort.abort(); // stream already closed by the client
                    }
                };
                try {
                    send('start', { provider, model });
                    let yielded = false;
                    for await (const piece of adapter({ ...params, signal })) {
                        if (signal.aborted) break;
                        if (typeof piece === 'string') {
                            if (piece) {
                                yielded = true;
                                send('chunk', { text: piece });
                            }
                            continue;
                        }
                        if (piece?.__usage) send('usage', piece.__usage);
                        if (piece?.__notice) send('notice', { message: piece.__notice });
                    }
                    if (signal.aborted) return;
                    if (yielded) send('done');
                    else send('error', { message: `Provider=${provider} produced no text. model=${model}` });
                } catch (error) {
                    if (signal.aborted) return;
                    console.warn('Error during stream generation.', error?.message || error);
                    send('error', { message: error?.message || 'Unknown error' });
                } finally {
                    try { controller.close(); } catch { /* already closed */ }
                }
            },
            cancel() {
                abort.abort();
            }
        });

        return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }
        });
    } catch (error) {
        console.error('Handler error - request processing failed', error);
        return jsonError(`Internal Server Error: ${error.message}`, 500);
    }
}
