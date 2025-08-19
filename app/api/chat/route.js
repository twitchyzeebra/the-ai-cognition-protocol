import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import * as Googleadapter from '../../../lib/llm-providers/google';
import * as OpenAIAdapter from '../../../lib/llm-providers/openai';
import * as AnthropicAdapter from '../../../lib/llm-providers/anthropic';
import * as MistralAdapter from '../../../lib/llm-providers/mistral';

// The 'edge' runtime has been removed to allow Node.js APIs like fs and crypto.

const ALGORITHM = 'aes-256-gcm';

function sanitizeStr(val) {
    if (typeof val !== 'string') return val;
    let t = val.trim();
    //removal of ALL characters above 255
    t = t.replace(/[\u0100-\uFFFF]/g, '');
    return t;
}

// Helper for JSON error responses
const jsonError = (error, status = 400) => new Response(JSON.stringify({ error }), {
    status, headers: { 'Content-Type': 'application/json' }
});

// Environment-aware error payload for SSE
const isDev = process.env.NODE_ENV === 'development';
function safeErrorPayload(input) {
    const raw = typeof input === 'string' ? input : ((input && input.message) ? input.message : '');
    if (isDev) {
        try {
            return { message: String(raw).slice(0, 500) };
        } catch {
            return { message: 'Error occurred' };
        }
    }
    return { message: 'An error occurred while generating a response.' };
}

// Provider configuration (adapters + fallback models)
const providers = {
    google: { adapter: Googleadapter, defaultModel: 'gemini-2.5-pro' },
    openai: { adapter: OpenAIAdapter, defaultModel: 'gpt-4o-mini' },
    anthropic: { adapter: AnthropicAdapter, defaultModel: 'claude-3-5-haiku-latest' },
    mistral: { adapter: MistralAdapter, defaultModel: 'mistral-large-latest' }
};

/**
 * Decrypts the given encrypted data.
 * @param {{iv: string, authTag: string, encrypted: string}} encryptedData - The encrypted data object.
 * @param {Buffer} key - The decryption key.
 * @returns {string} - The decrypted plaintext.
 */
function decrypt(encryptedData, key) {
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(encryptedData.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData.encrypted, 'hex')), decipher.final()]);
    
    return decrypted.toString('utf8');
}


function loadSystemPrompt(promptName = 'Modes') {
    const fallbackPrompt = "You are a helpful AI assistant.";
    try {
        // Use the specified prompt name or default to Modes.json
        const fileName = `${promptName}.json`;
        const encryptedPath = path.join(process.cwd(), 'SystemPrompts', 'Encrypted', fileName);
        
        if (!fs.existsSync(encryptedPath)) {
            console.log(`Encrypted system prompt file ${fileName} not found, using fallback.`);
            return fallbackPrompt;
        }

        const encryptionKey = process.env.SYSTEM_PROMPT_KEY;
        if (!encryptionKey || !/^[a-fA-F0-9]{64}$/.test(encryptionKey.trim())) {
            console.log("SYSTEM_PROMPT_KEY is invalid or not found in .env, using fallback.");
            return fallbackPrompt;
        }
        
        const key = Buffer.from(encryptionKey.trim(), 'hex');
        const encryptedData = JSON.parse(fs.readFileSync(encryptedPath, 'utf8'));

        // Validate the structure of the encrypted file
        if (!encryptedData.iv || !encryptedData.authTag || !encryptedData.encrypted) {
            console.error('Error: The encrypted file is malformed. It must contain "iv", "authTag", and "encrypted" keys. Using fallback.');
            return fallbackPrompt;
        }

        const decrypted = decrypt(encryptedData, key);
        console.log("System prompt successfully loaded and decrypted.");
        return decrypted;

    } catch (error) {
        console.error('An error occurred during system prompt loading/decryption. Check SYSTEM_PROMPT_KEY and file integrity.');
        return fallbackPrompt;
    }
}

// Learning Resources augmentation utilities
let learningResourcesCache = null;

function ensureLearningResourcesCache() { 
    if (learningResourcesCache) return learningResourcesCache;
    try {
        const dir = path.join(process.cwd(), 'learning-resources');
        const filenames = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.md'));
        const map = new Map();
        for (const filename of filenames) {
            const slug = filename.replace(/\.md$/, '');
            const title = slug.replace(/-/g, ' ');
            let content = '';
            try {
                content = fs.readFileSync(path.join(dir, filename), 'utf8');
            } catch (e) {
                console.warn(`Failed reading learning resource ${filename}:`, e?.message || e);
            }
            map.set(slug.toLowerCase(), { slug, title, content });
        }
        learningResourcesCache = map;
    } catch (e) {
        console.warn('Unable to load learning resources directory:', e?.message || e);
        learningResourcesCache = new Map();
    }
    return learningResourcesCache;
}

function normalizeText(s) {
    return (s || '').toString().toLowerCase();
}

function truncateText(s, max) {
    if (!s || s.length <= max) return s || '';
    return s.slice(0, max) + '\n... [truncated]';
}

/**
 * Builds an index of learning resources and conditionally includes full content
 * if the prompt/history mention a resource by title or slug.
 */
function buildLearningResourcesAugmentation(prompt, normalizedHistory) {
    const cache = ensureLearningResourcesCache();
    const items = Array.from(cache.values());
    if (!items.length) {
        return { indexText: '', includedText: '', includedSlugs: [] };
    }

    const indexLines = items.map(it => `- ${it.title} (slug: ${it.slug})`);
    const indexText = [
        '[Learning Resources Index]',
        'You have access to internal learning resources. Use them to guide your responses.',
        'If you need the full text of a resource, explicitly mention its exact title or slug in your reasoning or reply (e.g., "Metacognitive Tiers" or its slug). The server will inject the relevant content into the system context automatically.',
        'Only rely on sections that are relevant to the user’s query. Prefer citing headings when appropriate.',
        ...indexLines
    ].join('\n');

    const historyText = Array.isArray(normalizedHistory)
        ? normalizedHistory.map(m => m?.content || '').join('\n')
        : '';
    const corpus = normalizeText([prompt, historyText].filter(Boolean).join('\n'));
    const included = [];

    for (const it of items) {
        const titleL = normalizeText(it.title);
        const slugL = normalizeText(it.slug);
        if (corpus.includes(titleL) || corpus.includes(slugL)) {
            included.push(it);
        }
    }

    // Safety caps to avoid blowing context
    const MAX_TOTAL = 20000;
    const MAX_PER_DOC = 12000;

    let total = 0;
    const parts = [];
    for (const it of included) {
        const remaining = Math.max(0, MAX_TOTAL - total);
        if (remaining <= 0) break;
        const take = Math.min(MAX_PER_DOC, remaining);
        const body = truncateText(it.content, take);
        total += body.length;
        parts.push([
            `[Learning Resource: ${it.title} | slug: ${it.slug}]`,
            '---',
            body
        ].join('\n'));
    }

    const includedText = parts.length ? parts.join('\n\n') : '';
    const includedSlugs = included.map(it => it.slug);

    return { indexText, includedText, includedSlugs };
}

// Next.js API Route for streaming chat responses (Node.js runtime)
export async function POST(req) {
    try {
        // Parse request body with error handling
        let requestData;
        try {
            requestData = await req.json();
        } catch {
            return jsonError('Invalid JSON request body');
        }

        const { prompt, history, systemPrompt: selectedPrompt, provider, apiKey, model, temperature } = requestData;
        const p = (provider || 'google').toLowerCase().trim();
        const keySan = requestData.useDeveloperKey ? process.env.MISTRAL_API_KEY?.trim() : apiKey?.trim();
        const modelSan = (model || '').trim();
        const tempNum = Number.isFinite(Number(temperature)) ? Number(temperature) : undefined;
        let temperatureUsed = undefined;
        if (typeof tempNum === 'number') {
            if (p === 'anthropic' || p === 'mistral') {
                // Clamp to [0,1] for Anthropic and Mistral
                temperatureUsed = Math.min(1, Math.max(0, tempNum));
            } else {
                // Clamp to [0,2] for Google and OpenAI
                temperatureUsed = Math.min(2, Math.max(0, tempNum));
            }
        }

        // Validate inputs (500KB prompt, 500 items, 2MB total history)
        if (!prompt?.trim()) return jsonError('Invalid prompt');
        if (prompt.length > 500000) return jsonError(`Prompt too long. Maximum 500000 characters allowed.`, 413);
        
        
        // Basic validation only for now
        if (keySan && keySan.length > 1000) {
            return jsonError('API key too long', 413);
        }
        if (Array.isArray(history)) {
            if (history.length > 500) return jsonError(`Too many history items. Maximum 500 messages allowed.`, 413);
            const total = history.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
            if (total > 2000000) return jsonError(`History too long. Maximum 2000000 characters total allowed.`, 413);
        }

        const baseSystemInstruction = loadSystemPrompt(selectedPrompt);

        // Get provider config and validate
        const config = providers[p];
        if (!config) return jsonError(`Unsupported provider: ${p}`);
        if (!keySan) return jsonError('Missing API key. Provide your key in Settings.');

        const effectiveModel = modelSan || config.defaultModel;

        // Normalize history and create stream
        const normalizedHistory = Array.isArray(history) ? history.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: (m.content || (m.parts?.[0]?.text || '')).toString()
        })) : [];

        // Build learning-resources augmentation (index + conditional inclusion)
        const learningCtx = buildLearningResourcesAugmentation(prompt, normalizedHistory);
        const finalSystemInstruction = [baseSystemInstruction].filter(Boolean).join('\n\n'); //, learningCtx.indexText, learningCtx.includedText] Removed temporarily for testing
           // .filter(Boolean)
           // .join('\n\n');

        // Create a ReadableStream to pipe the AI response via adapter
        const stream = new ReadableStream({
            async start(controller) {
                let abort = false;
                const encoder = new TextEncoder();
                const sendEvent = (type, data) => {
                    try {
                        const message = `data: ${JSON.stringify({ type, ...data })}\n\n`;
                        controller.enqueue(encoder.encode(message));
                    } catch (e) {
                        console.error("Error sending event:", e);
                    }
                };

                try {
                    sendEvent('start', {});

                    const textStream = config.adapter.sendMessageStream({
                        apiKey: keySan,
                        model: effectiveModel,
                        prompt: prompt,
                        history: normalizedHistory,
                        systemInstruction: finalSystemInstruction,
                        temperature: temperatureUsed,
                    });

                    let yieldedAny = false;

                    for await (const piece of textStream) {
                        if (req.signal?.aborted) {
                            abort = true;
                            break;
                        }
                        const text = typeof piece === 'string' ? piece : '';
                        if (text.trim().length > 0) {
                            yieldedAny = true;
                            sendEvent('chunk', { text });
                        }
                    }
                    if(abort){
                        console.log("Request aborted");
                    }
                    else if (!yieldedAny) {
                        console.warn("Adapter stream returned no text", { provider: p, model: effectiveModel });
                        sendEvent('error', { message: `Provider=${p} produced no text. model=${effectiveModel}` });
                    } else if (!abort){
                        sendEvent('done', {});
                    }
                } catch (error) {
                    console.error("Error during stream generation. Check API key and model validity.", error?.message || error);
                    sendEvent('error', safeErrorPayload(error));
                } finally {
                    if(!abort){
                    controller.close();
                    }
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error("Handler error - request processing failed");
        return jsonError('Internal Server Error', 500);
    }
}
