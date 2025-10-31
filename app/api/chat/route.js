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

// Provider configuration (adapters + fallback models)
const providers = {
    google: { adapter: Googleadapter, defaultModel: 'gemini-2.5-pro' },
    openai: { adapter: OpenAIAdapter, defaultModel: 'gpt-4o-mini' },
    anthropic: { adapter: AnthropicAdapter, defaultModel: 'claude-3-5-haiku-latest' },
    mistral: { adapter: MistralAdapter, defaultModel: 'mistral-medium-latest' }
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
            console.error("Error: SYSTEM_PROMPT_KEY is invalid or not found in .env - using fallback prompt.");
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
        console.error('An error occurred during system prompt loading/decryption.');
        return fallbackPrompt;
    }
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

        const { prompt, history, systemPrompt: selectedPrompt, customPrompt, provider, apiKey, model, temperature } = requestData;
        const p = (provider || 'google').toLowerCase().trim();
        const keySan = requestData.useDeveloperKey ? process.env.ANTHROPIC_API_KEY?.trim() : apiKey?.trim();
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
        if (keySan && keySan.length > 150) {
            return jsonError('API key too long', 413);
        }
        if (Array.isArray(history)) {
            if (history.length > 500) return jsonError(`Too many history items. Maximum 500 messages allowed.`, 413);
            const total = history.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
            if (total > 2000000) return jsonError(`History too long. Maximum 2000000 characters total allowed.`, 413);
        }
        let baseSystemInstruction;
        if (selectedPrompt === 'Custom Prompt') {
            baseSystemInstruction = customPrompt;
        }
        else{
            baseSystemInstruction = loadSystemPrompt(selectedPrompt);
        }

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

        const finalSystemInstruction = [baseSystemInstruction].filter(Boolean).join('\n\n'); 

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
                        if (piece && typeof piece === 'object' && piece.__usage) {
                            // Forward provider-reported token usage to the client
                            sendEvent('usage', piece.__usage);
                            continue;
                        }
                        const text = typeof piece === 'string' ? piece : '';
                        if (text.trim().length > 0) {
                            yieldedAny = true;
                            sendEvent('chunk', { text });
                        }
                    }

                    if (abort) {
                        console.log("Request aborted");
                    }
                    else if (!yieldedAny) {
                        console.warn("Adapter stream returned no text", { provider: p, model: effectiveModel });
                        sendEvent('error', { message: `Provider=${p} produced no text. model=${effectiveModel}` });
                    } else if (!abort){
                        sendEvent('done', {});
                    }
                } catch (error) {   
                    console.warn("Error during stream generation.", error?.message || error);
                    sendEvent('error', { message: error.message || 'Unknown error'});
                    
                } finally {
                    if(!abort){
                        try { controller.close(); } catch (e) { /* ignore */ }
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
        return jsonError('Internal Server Error: ${error.message}', 500);
    }
}
