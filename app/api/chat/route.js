import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

// The 'edge' runtime has been removed to allow Node.js APIs like fs and crypto.

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set.");
}
const genAI = new GoogleGenerativeAI(API_KEY);

const ALGORITHM = 'aes-256-gcm';

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


function loadSystemPrompt() {
    const fallbackPrompt = "You are a helpful AI assistant.";
    try {
        const encryptedPath = path.join(process.cwd(), 'system-prompt-encrypted.json');
        
        if (!fs.existsSync(encryptedPath)) {
            console.log("Encrypted system prompt file not found, using fallback.");
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
        console.error('An error occurred during system prompt loading/decryption:', error);
        return fallbackPrompt;
    }
}

// Next.js API Route for streaming chat responses (Node.js runtime)
export async function POST(req) {
    try {
        const { prompt, history } = await req.json();

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return new Response(JSON.stringify({ error: 'Invalid prompt' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const systemPrompt = loadSystemPrompt();
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-pro",
            systemInstruction: systemPrompt,
        });
        
        const validHistory = (Array.isArray(history) ? history : []).filter(
            (m) => m.parts.every((p) => p.text && p.text.trim() !== '')
        );

        const chat = model.startChat({ 
            history: validHistory
        });
        const result = await chat.sendMessageStream(prompt);

        // Create a ReadableStream to pipe the AI response
        const stream = new ReadableStream({
            async start(controller) {
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

                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        if (chunkText) {
                            sendEvent('chunk', { text: chunkText });
                        }
                    }

                    sendEvent('done', {});
                } catch (error) {
                    console.error("Error during stream generation:", error);
                    sendEvent('error', { message: 'Error generating response from the model.' });
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*', // CORS for development
            },
        });

    } catch (error) {
        console.error("Handler error:", error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
