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

// Unlimited streaming function using chunked transfer encoding
async function unlimitedStreamResponse(model, prompt, clientIP) {
    const startTime = Date.now();
    
    try {
        console.log(`[${clientIP}] Starting UNLIMITED streaming response...`);
        
        // Generate content with streaming - truly unlimited time
        const result = await model.generateContentStream(prompt);
        
        let fullText = '';
        let chunkCount = 0;
        let responseChunks = [];
        
        // Collect all chunks without any timeout constraints
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                fullText += chunkText;
                chunkCount++;
                
                // Store chunk for potential progressive sending
                responseChunks.push(chunkText);
                
                const elapsed = Date.now() - startTime;
                if (chunkCount % 10 === 0) {
                    console.log(`[${clientIP}] Unlimited streaming: ${chunkCount} chunks, ${fullText.length} chars, ${elapsed}ms`);
                }
            }
        }
        
        const duration = Date.now() - startTime;
        console.log(`[${clientIP}] UNLIMITED streaming completed: ${duration}ms, ${chunkCount} chunks, ${fullText.length} chars`);
        
        return {
            success: true,
            text: fullText,
            duration: duration,
            chunks: chunkCount,
            length: fullText.length,
            unlimited: true
        };
        
    } catch (error) {
        console.error(`[${clientIP}] Unlimited streaming error:`, error.message);
        return {
            success: false,
            error: error.message,
            text: 'Error in unlimited streaming response.'
        };
    }
}

exports.handler = async (event) => {
    const startTime = Date.now();
    
    // CORS headers for unlimited streaming
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const { prompt } = JSON.parse(event.body);
        const clientIP = event.headers['x-forwarded-for'] || 'unknown';
        
        if (!prompt || prompt.trim().length === 0) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Prompt is required' })
            };
        }
        
        console.log(`[${clientIP}] UNLIMITED CHAT REQUEST: "${prompt.substring(0, 100)}..."`);
        
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
                            console.log('✅ System prompt decrypted for unlimited streaming');
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not load encrypted system prompt for unlimited streaming:', error.message);
        }
        
        const fullPrompt = `${SECRET_SYSTEM_PROMPT}\n\nUser: ${prompt}\nAI:`;
        
        // Use unlimited streaming
        const result = await unlimitedStreamResponse(model, fullPrompt, clientIP);
        
        if (result.success) {
            return {
                statusCode: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    response: result.text,
                    streaming: true,
                    unlimited: true,
                    duration: result.duration,
                    chunks: result.chunks,
                    length: result.length,
                    model: "gemini-2.5-pro"
                })
            };
        } else {
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: result.error || 'Unlimited streaming failed',
                    text: result.text
                })
            };
        }
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Unlimited streaming error after ${duration}ms:`, error.message);
        
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Internal server error in unlimited streaming',
                duration: duration
            })
        };
    }
};
