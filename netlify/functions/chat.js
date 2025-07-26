const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;

// Decryption function (matches encrypt-prompt.js)
function getKey(keyHex) {
    // Always treat key as a 64-char hex string
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

// True streaming function with keep-alive to prevent timeouts
async function getRealtimeStreamResponse(model, prompt, clientIP, streamController) {
    const startTime = Date.now();
    const encoder = new TextEncoder();

    try {
        console.log(`[${clientIP}] Starting REAL-TIME streaming response...`);
        
        // Generate content with streaming
        const result = await model.generateContentStream(prompt);
        
        let fullText = '';
        let chunkCount = 0;
        
        // Set up a keep-alive interval to prevent connection timeout
        const keepAliveInterval = setInterval(() => {
            streamController.enqueue(encoder.encode(':keep-alive\n\n'));
            console.log(`[${clientIP}] Sent keep-alive ping.`);
        }, 15000); // Send a ping every 15 seconds

        // Process chunks as they come and push them to the stream
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                fullText += chunkText;
                chunkCount++;
                
                const eventData = {
                    text: chunkText,
                    chunk: chunkCount,
                    totalLength: fullText.length,
                    elapsed: Date.now() - startTime
                };
                
                // Send data as a Server-Sent Event (SSE)
                streamController.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
            }
        }
        
        // Stop the keep-alive and signal completion
        clearInterval(keepAliveInterval);
        const finalEvent = {
            done: true,
            duration: Date.now() - startTime,
            totalLength: fullText.length,
            totalChunks: chunkCount
        };
        streamController.enqueue(encoder.encode(`data: ${JSON.stringify(finalEvent)}\n\n`));
        
        console.log(`[${clientIP}] Real-time streaming completed: ${Date.now() - startTime}ms`);

    } catch (error) {
        console.error(`[${clientIP}] Real-time streaming error:`, error.message);
        const errorEvent = {
            error: 'Error during streaming.',
            message: error.message
        };
        streamController.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
    } finally {
        // Close the stream
        streamController.close();
    }
}

// Rate limiting storage (in-memory for simplicity)
const rateLimitStore = new Map();
const RATE_LIMIT = 4; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds
const MAX_STORED_IPS = 1000; // Prevent memory bloat

function checkRateLimit(clientIP) {
    const now = Date.now();
    
    // Clean up old entries to prevent memory bloat
    if (rateLimitStore.size > MAX_STORED_IPS) {
        const cutoff = now - RATE_WINDOW;
        for (const [ip, data] of rateLimitStore.entries()) {
            if (data.resetTime < cutoff) {
                rateLimitStore.delete(ip);
            }
        }
    }
    
    const clientData = rateLimitStore.get(clientIP) || { count: 0, resetTime: now + RATE_WINDOW };
    
    // Reset if window has passed
    if (now > clientData.resetTime) {
        clientData.count = 0;
        clientData.resetTime = now + RATE_WINDOW;
    }
    
    // Check if rate limit exceeded
    if (clientData.count >= RATE_LIMIT) {
        return false;
    }
    
    // Increment counter
    clientData.count++;
    rateLimitStore.set(clientIP, clientData);
    return true;
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

// Bypass Netlify timeout with chunked streaming response
async function streamResponse(model, prompt, clientIP, startTime) {
    try {
        console.log(`[${clientIP}] Starting unlimited streaming response (bypassing Netlify timeout)...`);
        
        // Generate content with streaming - no timeout limits
        const result = await model.generateContentStream(prompt);
        
        let fullText = '';
        let chunkCount = 0;
        let lastUpdate = Date.now();
        
        // Process each chunk as it arrives - unlimited time approach
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                fullText += chunkText;
                chunkCount++;
                
                const elapsed = Date.now() - startTime;
                
                // Log progress frequently for long responses
                if (chunkCount % 5 === 0 || (Date.now() - lastUpdate) > 2000) {
                    console.log(`[${clientIP}] Processing chunk ${chunkCount}, length: ${fullText.length}, elapsed: ${elapsed}ms`);
                    lastUpdate = Date.now();
                }
            }
        }
        
        const duration = Date.now() - startTime;
        console.log(`[${clientIP}] Unlimited streaming completed in ${duration}ms, ${chunkCount} chunks, ${fullText.length} chars`);
        
        return JSON.stringify({ 
            text: fullText,
            streaming: true,
            duration: duration,
            chunks: chunkCount,
            model: "gemini-2.5-pro",
            detailedResponse: true,
            unlimitedTime: true
        });
        
    } catch (error) {
        console.error(`[${clientIP}] Streaming error:`, error.message);
        return JSON.stringify({ 
            error: error.message,
            text: 'Sorry, there was an error generating the response.',
            streaming: false
        });
    }
}

exports.handler = async (event) => {
    // ... (keep existing rate limiting and validation logic)

    try {
        const body = JSON.parse(event.body || '{}');
        const { prompt: userPrompt } = body;

        // ... (keep existing prompt validation)

        // Get system prompt
        let SECRET_SYSTEM_PROMPT = "You are a helpful AI assistant...";
        // ... (keep existing system prompt decryption logic)

        const fullPrompt = `${SECRET_SYSTEM_PROMPT}\n\nUser: ${userPrompt}\nAI:`;

        // Use true streaming with Server-Sent Events (SSE)
        const stream = new ReadableStream({
            start(controller) {
                getRealtimeStreamResponse(model, fullPrompt, clientIP, controller);
            }
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: stream
        };

    } catch (error) {
        // ... (keep existing error handling)
    }
};