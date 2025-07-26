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

// Multi-part response system
async function getMultiPartResponse(model, prompt, clientIP, requestId = null) {
    const startTime = Date.now();
    
    try {
        console.log(`[${clientIP}] Starting multi-part response (Request ID: ${requestId})...`);
        
        // Special prompt instruction for long responses
        const longResponsePrompt = `${prompt}\n\n[INSTRUCTION: If this is a complex topic that requires a long response, please provide a comprehensive and detailed answer. Take your time to be thorough and complete.]`;
        
        // Generate content with streaming
        const result = await model.generateContentStream(longResponsePrompt);
        
        let fullText = '';
        let chunkCount = 0;
        let parts = [];
        let currentPart = '';
        const maxPartSize = 2000; // Split into manageable parts
        
        // Process chunks and split into parts
        for await (const chunk of result.stream) {
            const elapsed = Date.now() - startTime;
            
            // Generous timeout - break at 23 seconds to leave buffer
            if (elapsed > 23000) {
                console.log(`[${clientIP}] Breaking at 23s to avoid timeout, collected ${fullText.length} chars`);
                break;
            }
            
            const chunkText = chunk.text();
            if (chunkText) {
                fullText += chunkText;
                currentPart += chunkText;
                chunkCount++;
                
                // Split into parts to enable continuation
                if (currentPart.length > maxPartSize) {
                    parts.push(currentPart);
                    currentPart = '';
                }
                
                // Log progress
                if (chunkCount % 2 === 0) {
                    console.log(`[${clientIP}] Multi-part progress: ${chunkCount} chunks, ${fullText.length} chars, ${elapsed}ms`);
                }
            }
        }
        
        // Add any remaining content
        if (currentPart.length > 0) {
            parts.push(currentPart);
        }
        
        const duration = Date.now() - startTime;
        const needsContinuation = duration > 22000 && fullText.length > 1000;
        
        console.log(`[${clientIP}] Multi-part response completed: ${duration}ms, ${chunkCount} chunks, ${fullText.length} chars, ${parts.length} parts`);
        
        return {
            success: true,
            text: fullText,
            duration: duration,
            chunks: chunkCount,
            length: fullText.length,
            parts: parts,
            needsContinuation: needsContinuation,
            requestId: requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[${clientIP}] Multi-part response error after ${duration}ms:`, error.message);
        return {
            success: false,
            error: error.message,
            text: 'Error in multi-part response generation.',
            duration: duration
        };
    }
}

exports.handler = async (event) => {
    const startTime = Date.now();
    
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Request-ID',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
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
        const { prompt, requestId, continueFrom } = JSON.parse(event.body);
        const clientIP = event.headers['x-forwarded-for'] || 'unknown';
        const requestIdentifier = requestId || event.headers['x-request-id'];
        
        if (!prompt || prompt.trim().length === 0) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Prompt is required' })
            };
        }
        
        console.log(`[${clientIP}] MULTI-PART CHAT REQUEST: "${prompt.substring(0, 100)}..." (ID: ${requestIdentifier})`);
        
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
                            console.log('✅ System prompt decrypted for multi-part response');
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not load encrypted system prompt:', error.message);
        }
        
        let fullPrompt;
        
        if (continueFrom) {
            // This is a continuation request
            fullPrompt = `${SECRET_SYSTEM_PROMPT}\n\nUser: ${prompt}\n\nPrevious response (partial): ${continueFrom}\n\nAI: [Continue the response from where you left off, maintaining the same tone and context]`;
        } else {
            // This is a new request
            fullPrompt = `${SECRET_SYSTEM_PROMPT}\n\nUser: ${prompt}\nAI:`;
        }
        
        // Get multi-part response
        const result = await getMultiPartResponse(model, fullPrompt, clientIP, requestIdentifier);
        
        if (result.success) {
            const response = {
                response: result.text,
                streaming: true,
                multiPart: true,
                duration: result.duration,
                chunks: result.chunks,
                length: result.length,
                parts: result.parts.length,
                needsContinuation: result.needsContinuation,
                requestId: result.requestId,
                model: "gemini-2.5-pro"
            };
            
            return {
                statusCode: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'X-Request-ID': result.requestId
                },
                body: JSON.stringify(response)
            };
        } else {
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: result.error || 'Multi-part response failed',
                    text: result.text,
                    duration: result.duration
                })
            };
        }
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Multi-part response error after ${duration}ms:`, error.message);
        
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Internal server error in multi-part response',
                duration: duration,
                message: error.message
            })
        };
    }
};
