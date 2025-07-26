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

// Progressive streaming with timeout prevention
async function getProgressiveStreamResponse(model, prompt, clientIP) {
    const startTime = Date.now();
    
    try {
        console.log(`[${clientIP}] Starting progressive streaming response...`);
        
        // Generate content with streaming - let it complete naturally
        const result = await model.generateContentStream(prompt);
        
        let fullText = '';
        let chunkCount = 0;
        let lastActivity = Date.now();
        const chunks = [];
        
        // Process chunks as they come - collect them for sending
        for await (const chunk of result.stream) {
            const elapsed = Date.now() - startTime;
            
            const chunkText = chunk.text();
            if (chunkText) {
                fullText += chunkText;
                chunkCount++;
                lastActivity = Date.now();
                
                // Store chunk data for potential multi-part sending
                chunks.push({
                    text: chunkText,
                    fullText: fullText,
                    chunkNumber: chunkCount,
                    elapsed: elapsed,
                    totalLength: fullText.length
                });
                
                // Check if we're approaching timeout (20 seconds)
                if (elapsed > 20000) {
                    console.log(`[${clientIP}] Approaching timeout at ${elapsed}ms, preparing to return partial response...`);
                    return {
                        success: true,
                        text: fullText,
                        duration: elapsed,
                        chunks: chunkCount,
                        isPartial: true,
                        needsContinuation: true,
                        progressive: true
                    };
                }
                
                // Log progress every 10 chunks
                if (chunkCount % 10 === 0) {
                    console.log(`[${clientIP}] Progressive streaming: ${chunkCount} chunks, ${fullText.length} chars, ${elapsed}ms`);
                }
            }
        }
        
        const duration = Date.now() - startTime;
        console.log(`[${clientIP}] Progressive streaming completed: ${duration}ms, ${chunkCount} chunks, ${fullText.length} chars`);
        
        return {
            success: true,
            text: fullText,
            duration: duration,
            chunks: chunkCount,
            isPartial: false,
            needsContinuation: false,
            progressive: true
        };
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[${clientIP}] Progressive streaming error after ${duration}ms:`, error.message);
        return {
            success: false,
            error: error.message,
            text: 'Error in progressive streaming response.',
            duration: duration
        };
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
    const startTime = Date.now();
    
    // Ensure event and headers exist
    if (!event) {
        console.error('Event object is undefined');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
    
    // Get client IP for rate limiting with proper null checking
    const headers = event.headers || {};
    const clientIP = headers['x-forwarded-for'] || headers['client-ip'] || 'unknown';
    
    // Log request for debugging
    console.log(`[${new Date().toISOString()}] Chat request from ${clientIP}`);

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        console.warn(`[${clientIP}] Method not allowed: ${event.httpMethod}`);
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Check rate limit
    if (!checkRateLimit(clientIP)) {
        console.warn(`[${clientIP}] Rate limit exceeded`);
        return {
            statusCode: 429,
            body: JSON.stringify({ error: 'Rate limit exceeded. Maximum 4 requests per minute.' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    // Return error if env vars are missing
    if (!API_KEY) {
        console.error('GEMINI_API_KEY environment variable missing');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server configuration error." }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { prompt: userPrompt } = body;

        if (!userPrompt || typeof userPrompt !== 'string') {
            console.warn(`[${clientIP}] Invalid prompt provided`);
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Bad Request: Valid prompt required.' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        // Limit prompt length - increased for detailed conversations
        const MAX_PROMPT_LENGTH = 75000; // 75k characters for comprehensive prompts
        if (userPrompt.length > MAX_PROMPT_LENGTH) {
            console.warn(`[${clientIP}] Prompt too long: ${userPrompt.length} characters`);
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: `Prompt too long. Maximum ${MAX_PROMPT_LENGTH} characters allowed.` }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        // Get system prompt by decrypting the stored file
        let SECRET_SYSTEM_PROMPT = "You are a helpful AI assistant. Provide detailed, comprehensive, and thorough responses."; // fallback
        
        try {
            // Try to load and decrypt the system prompt
            const encryptedFilePath = path.join(__dirname, '../../system-prompt-encrypted.json');
            
            if (!fs.existsSync(encryptedFilePath)) {
                console.warn('⚠️ Encrypted system prompt file not found, using fallback');
            } else {
                const encryptedFile = fs.readFileSync(encryptedFilePath, 'utf8');
                const encryptedData = JSON.parse(encryptedFile);
                
                if (!encryptedData || !encryptedData.data) {
                    console.warn('⚠️ Invalid encrypted data structure, using fallback');
                } else {
                    const encryptionKey = process.env.SYSTEM_PROMPT_KEY;
                    if (encryptionKey) {
                        const decrypted = decryptSystemPrompt(encryptedData.data, encryptionKey);
                        if (decrypted) {
                            SECRET_SYSTEM_PROMPT = decrypted;
                            console.log('✅ System prompt decrypted successfully');
                        } else {
                            console.warn('⚠️ Failed to decrypt system prompt, using fallback');
                        }
                    } else {
                        console.warn('⚠️ SYSTEM_PROMPT_KEY not found, using fallback');
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not load encrypted system prompt:', error.message);
        }

        const fullPrompt = `${SECRET_SYSTEM_PROMPT}\n\nUser: ${userPrompt}\nAI:`;

        console.log(`[${clientIP}] Starting streaming response`);

        // Use progressive streaming by default - no timeouts, full responses
        const result = await getProgressiveStreamResponse(model, fullPrompt, clientIP);
        
        if (result.success) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify({
                    text: result.text,
                    streaming: result.streaming,
                    progressive: true,
                    duration: result.duration,
                    chunks: result.chunks,
                    length: result.length,
                    model: "gemini-2.5-pro"
                })
            };
        } else {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify({
                    error: result.error,
                    text: result.text,
                    duration: result.duration
                })
            };
        }

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[${clientIP}] Error after ${duration}ms:`, error.message);
        console.error('Stack trace:', error.stack);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};