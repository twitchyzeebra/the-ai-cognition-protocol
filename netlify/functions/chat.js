const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

// Conditionally import @netlify/functions for production environment
let stream;
try {
  const netlifyFunctions = require("@netlify/functions");
  stream = netlifyFunctions.stream;
  console.log("Successfully imported Netlify stream handler.");
} catch (e) {
  // Fallback for local development
  console.log("Using fallback stream handler for local development.");
  stream = (handler) => handler;
}

const API_KEY = process.env.GEMINI_API_KEY;

// Decryption function
function getKey(keyHex) {
    if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
        throw new Error('Encryption key must be a 64-character hex string');
    }
    return Buffer.from(keyHex, 'hex');
}

function decryptSystemPrompt(encryptedData, password) {
    try {
        const algorithm = 'aes-256-gcm';
        const key = getKey(password);
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const authTag = Buffer.from(encryptedData.authTag, 'hex');
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error.message);
        return null;
    }
}

// This function runs the AI stream and pushes data to the client
async function streamAIResponse(model, prompt, clientIP, readableStream) {
    try {
        const startTime = Date.now();
        console.log(`[${clientIP}] Starting AI content stream...`);
        
        const result = await model.generateContentStream(prompt);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                readableStream.push(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
        }

        const finalEvent = {
            done: true,
            duration: Date.now() - startTime,
        };
        readableStream.push(`data: ${JSON.stringify(finalEvent)}\n\n`);
        console.log(`[${clientIP}] AI stream finished.`);

    } catch (error) {
        console.error(`[${clientIP}] AI streaming error:`, error.message);
        readableStream.push(`data: ${JSON.stringify({ error: 'Error during streaming.' })}\n\n`);
    } finally {
        readableStream.push(null); // End the stream
    }
}

// Rate limiting
const rateLimitStore = new Map();
const RATE_LIMIT = 4;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(clientIP) {
    const now = Date.now();
    const clientData = rateLimitStore.get(clientIP) || { count: 0, resetTime: now + RATE_WINDOW };
    
    if (now > clientData.resetTime) {
        clientData.count = 0;
        clientData.resetTime = now + RATE_WINDOW;
    }
    
    if (clientData.count >= RATE_LIMIT) return false;
    
    clientData.count++;
    rateLimitStore.set(clientIP, clientData);
    return true;
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

// The main handler, wrapped with the Netlify stream utility for production
exports.handler = stream(async (event, context) => {
    // For local development, this is crucial for streaming to work
    if (context && !process.env.NETLIFY) {
        context.callbackWaitsForEmptyEventLoop = false;
    }

    const clientIP = event.headers['x-forwarded-for'] || 'unknown';

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    if (!checkRateLimit(clientIP)) {
        return {
            statusCode: 429,
            body: JSON.stringify({ error: 'Rate limit exceeded.' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    if (!API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server configuration error." }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        const { prompt: userPrompt } = JSON.parse(event.body || '{}');

        if (!userPrompt) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Bad Request: Valid prompt required.' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        let SECRET_SYSTEM_PROMPT = "You are a helpful AI assistant.";
        try {
            const encryptedFilePath = path.join(__dirname, '../../system-prompt-encrypted.json');
            if (fs.existsSync(encryptedFilePath)) {
                const encryptedFile = fs.readFileSync(encryptedFilePath, 'utf8');
                const encryptedData = JSON.parse(encryptedFile);
                const encryptionKey = process.env.SYSTEM_PROMPT_KEY;
                if (encryptedData?.data && encryptionKey) {
                    const decrypted = decryptSystemPrompt(encryptedData.data, encryptionKey);
                    if (decrypted) SECRET_SYSTEM_PROMPT = decrypted;
                }
            }
        } catch (error) {
            console.warn('Could not load encrypted system prompt:', error.message);
        }

        const fullPrompt = `${SECRET_SYSTEM_PROMPT}\n\nUser: ${userPrompt}\nAI:`;

        const readableStream = new Readable({ read() {} });
        
        // Start the AI stream in the background. 
        // The handler returns the readableStream immediately.
        streamAIResponse(model, fullPrompt, clientIP, readableStream);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
            body: readableStream,
        };

    } catch (error) {
        console.error(`[${clientIP}] Handler error:`, error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
});