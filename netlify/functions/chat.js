const { GoogleGenerativeAI } = require("@google/generative-ai");

// Import Netlify streaming functions
let stream;
try {
  const netlifyFunctions = require("@netlify/functions");
  stream = netlifyFunctions.stream;
} catch (e) {
  // Fallback for local development
  stream = (handler) => handler;
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("GEMINI_API_KEY environment variable not set.");
    throw new Error("GEMINI_API_KEY environment variable not set.");
}
const genAI = new GoogleGenerativeAI(API_KEY);

// Simple system prompt loader with fallback
function loadSystemPrompt() {
    try {
        const fs = require('fs');
        const crypto = require('crypto');
        const path = require('path');
        
        // Try to load the encrypted system prompt
        const encryptedPath = path.join(__dirname, '../../system-prompt-encrypted.json');
        if (fs.existsSync(encryptedPath)) {
            const encryptedData = JSON.parse(fs.readFileSync(encryptedPath, 'utf8'));
            
            // Get decryption key from environment
            const encryptionKey = process.env.SYSTEM_PROMPT_KEY;
            console.log("Raw SYSTEM_PROMPT_KEY value:", typeof encryptionKey, encryptionKey ? `Length: ${encryptionKey.length}` : "undefined/null");
            
            if (!encryptionKey || encryptionKey.trim() === '') {
                console.log("SYSTEM_PROMPT_KEY environment variable not found or empty, using fallback");
                return "You are a helpful AI assistant.";
            }
            
            // Validate key format (should be 64-character hex string)
            const trimmedKey = encryptionKey.trim();
            console.log("Trimmed key length:", trimmedKey.length, "First 8 chars:", trimmedKey.substring(0, 8));
            
            if (!/^[a-fA-F0-9]{64}$/.test(trimmedKey)) {
                console.log("Invalid SYSTEM_PROMPT_KEY format (expected 64-char hex), using fallback");
                console.log("Key validation failed. Key:", trimmedKey);
                return "You are a helpful AI assistant.";
            }
            
            // Decrypt the system prompt using the same method as encrypt-prompt.js
            try {
                // Validate encrypted data structure
                if (!encryptedData.iv || !encryptedData.authTag || !encryptedData.encrypted) {
                    console.log("Invalid encrypted data structure, using fallback");
                    return "You are a helpful AI assistant.";
                }
                
                const key = Buffer.from(trimmedKey, 'hex');
                const iv = Buffer.from(encryptedData.iv, 'hex');
                const authTag = Buffer.from(encryptedData.authTag, 'hex');
                const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                decipher.setAuthTag(authTag);
                
                let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                
                console.log("System prompt successfully loaded and decrypted");
                return decrypted;
            } catch (decryptError) {
                console.error("Decryption failed:", decryptError);
                return "You are a helpful AI assistant.";
            }
        }
        console.log("Encrypted system prompt file not found, using fallback");
        return "You are a helpful AI assistant.";
    } catch (error) {
        console.error('System prompt loading failed:', error);
        return "You are a helpful AI assistant.";
    }
}

// Streaming handler that sends chunks in real-time
exports.handler = stream(async (event, context) => {
    // Add debugging logs to track execution
    console.log("Function started");
    console.log("Environment Variables:", {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "[SET]" : "[NOT SET]",
        NETLIFY: process.env.NETLIFY ? "[SET]" : "[NOT SET]",
    });

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
            body: '',
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        console.log("Parsing request body");
        const body = JSON.parse(event.body);
        const { prompt, history } = body;

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return { 
                statusCode: 400, 
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({ error: 'Invalid prompt: Prompt must be a non-empty string.' })
            };
        }

        console.log("Loading system prompt");
        const systemPrompt = loadSystemPrompt();
        
        console.log("Initializing Gemini model");
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        
        // Prepare history with system prompt
        let fullHistory = Array.isArray(history) ? [...history] : [];
        if (systemPrompt && (!fullHistory.length || fullHistory[0].role !== 'user')) {
            fullHistory.unshift({ role: 'user', parts: [{ text: systemPrompt }] });
        }

        console.log("Starting chat");
        const chat = model.startChat({
            history: fullHistory,
        });

        console.log("Sending message stream");
        const result = await chat.sendMessageStream(prompt);

        // Create a readable stream for real-time streaming
        const { Readable } = require('stream');
        const readableStream = new Readable({
            read() {}
        });

        // Start streaming chunks immediately
        (async () => {
            try {
                // Send start signal
                readableStream.push('data: {"type":"start"}\n\n');
                
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        // Send each chunk immediately
                        const sseData = `data: ${JSON.stringify({type:"chunk",text:chunkText})}\n\n`;
                        readableStream.push(sseData);
                    }
                }
                
                // Send completion signal
                readableStream.push('data: {"type":"done"}\n\n');
                readableStream.push(null); // End stream
                console.log("Response complete");
                
            } catch (streamError) {
                console.error("Stream error:", streamError);
                readableStream.push(`data: ${JSON.stringify({type:"error",message:streamError.message})}\n\n`);
                readableStream.push(null);
            }
        })();

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
            body: readableStream,
        };

    } catch (error) {
        console.error("Handler error:", error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ 
                error: 'Internal Server Error: ' + error.message,
                success: false
            }),
        };
    }
});