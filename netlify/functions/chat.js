const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set.");
}

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

const genAI = new GoogleGenerativeAI(API_KEY);

exports.handler = async (event) => {
    const startTime = Date.now();
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const { prompt, history } = JSON.parse(event.body || '{}');
        const clientIP = event.headers['x-forwarded-for'] || 'unknown';
        
        if (!prompt || prompt.trim().length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Prompt is required' })
            };
        }
        
        console.log(`[${clientIP}] Chat request: "${prompt.substring(0, 100)}..."`);
        
        // Load encrypted system prompt
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
                            console.log('✅ System prompt decrypted successfully');
                        }
                    } else {
                        console.warn('⚠️ SYSTEM_PROMPT_KEY not found in environment');
                    }
                }
            } else {
                console.warn('⚠️ Encrypted system prompt file not found');
            }
        } catch (error) {
            console.warn('⚠️ Could not load encrypted system prompt:', error.message);
        }
        
        // Initialize model
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-pro",
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.7,
            }
        });
        
        // Create full prompt with system instructions
        const fullPrompt = `${SECRET_SYSTEM_PROMPT}\n\nUser: ${prompt}\nAI:`;
        
        console.log(`[${clientIP}] Starting AI generation...`);
        
        // Generate response
        const result = await model.generateContent(fullPrompt);
        const response = result.response;
        const text = response.text();
        
        const duration = Date.now() - startTime;
        console.log(`[${clientIP}] Generation completed in ${duration}ms, ${text.length} chars`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                text: text,
                duration: duration,
                model: "gemini-2.5-pro",
                length: text.length,
                success: true
            })
        };
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Chat error after ${duration}ms:`, error.message);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'AI generation failed',
                duration: duration,
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            })
        };
    }
};