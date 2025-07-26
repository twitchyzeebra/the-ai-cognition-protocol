const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;

// Decryption function for system prompt
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

// Initialize Gemini
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

exports.handler = async (event) => {
    const startTime = Date.now();
    
    // Headers for progressive streaming
    const streamHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: streamHeaders,
            body: ''
        };
    }
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: streamHeaders,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const { prompt } = JSON.parse(event.body);
        const clientIP = event.headers['x-forwarded-for'] || 'unknown';
        
        if (!prompt || prompt.trim().length === 0) {
            return {
                statusCode: 400,
                headers: streamHeaders,
                body: JSON.stringify({ error: 'Prompt is required' })
            };
        }
        
        console.log(`[${clientIP}] PROGRESSIVE STREAMING REQUEST: "${prompt.substring(0, 100)}..."`);
        
        // Load system prompt
        let SECRET_SYSTEM_PROMPT = "You are a helpful AI assistant.";
        
        try {
            const encryptedFilePath = path.join(__dirname, '../../system-prompt-encrypted.json');
            
            if (fs.existsSync(encryptedFilePath)) {
                const encryptedFile = fs.readFileSync(encryptedFilePath, 'utf8');
                const encryptedData = JSON.parse(encryptedFile);
                
                if (encryptedData?.data) {
                    const encryptionKey = process.env.SYSTEM_PROMPT_KEY;
                    if (encryptionKey) {
                        const decrypted = decryptSystemPrompt(encryptedData.data, encryptionKey);
                        if (decrypted) {
                            SECRET_SYSTEM_PROMPT = decrypted;
                            console.log('✅ System prompt decrypted for progressive streaming');
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not load encrypted system prompt:', error.message);
        }
        
        const fullPrompt = `${SECRET_SYSTEM_PROMPT}\n\nUser: ${prompt}\nAI:`;
        
        // Start progressive streaming
        console.log(`[${clientIP}] Starting progressive AI generation...`);
        
        // Generate content with streaming
        const result = await model.generateContentStream(fullPrompt);
        
        let fullText = '';
        let chunkCount = 0;
        let responseData = [];
        
        // Collect all chunks (we can't actually stream in Netlify functions, but we can simulate it)
        for await (const chunk of result.stream) {
            const elapsed = Date.now() - startTime;
            
            const chunkText = chunk.text();
            if (chunkText) {
                fullText += chunkText;
                chunkCount++;
                
                // Simulate progressive data
                responseData.push({
                    chunk: chunkCount,
                    text: chunkText,
                    elapsed: elapsed,
                    totalLength: fullText.length
                });
                
                // Log progress
                if (chunkCount % 5 === 0) {
                    console.log(`[${clientIP}] Progressive streaming: ${chunkCount} chunks, ${fullText.length} chars, ${elapsed}ms`);
                }
            }
        }
        
        const duration = Date.now() - startTime;
        console.log(`[${clientIP}] Progressive streaming completed: ${duration}ms, ${chunkCount} chunks, ${fullText.length} chars`);
        
        // Return the complete response with progressive data
        return {
            statusCode: 200,
            headers: {
                ...streamHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                response: fullText,
                streaming: true,
                progressive: true,
                duration: duration,
                chunks: chunkCount,
                length: fullText.length,
                progressiveData: responseData,
                model: "gemini-2.5-pro"
            })
        };
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Progressive streaming error after ${duration}ms:`, error.message);
        
        return {
            statusCode: 500,
            headers: streamHeaders,
            body: JSON.stringify({
                error: 'Progressive streaming failed',
                duration: duration,
                message: error.message
            })
        };
    }
};
