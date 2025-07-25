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

// Check for missing environment variables
if (!API_KEY) {
    console.error("Missing GEMINI_API_KEY environment variable.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

exports.handler = async (event) => {
    // *** THIS IS THE NEW DIAGNOSTIC LINE ***
    console.log("RECEIVED EVENT:", JSON.stringify(event, null, 2));

    // Log environment variable presence (not values)
    console.log("GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Return error if env vars are missing
    if (!API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Missing GEMINI_API_KEY environment variable." }),
        };
    }

    try {
        const { prompt: userPrompt } = JSON.parse(event.body);

        if (!userPrompt) {
            return { statusCode: 400, body: 'Bad Request: No prompt provided.' };
        }

        // Get system prompt by decrypting the stored file
        let SECRET_SYSTEM_PROMPT = "You are a helpful AI assistant."; // fallback
        
        try {
            // Try to load and decrypt the system prompt
            const encryptedFilePath = path.join(__dirname, '../../system-prompt-encrypted.json');
            const encryptedFile = fs.readFileSync(encryptedFilePath, 'utf8');
            const encryptedData = JSON.parse(encryptedFile);
            
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
        } catch (error) {
            console.warn('⚠️ Could not load encrypted system prompt:', error.message);
        }

        const fullPrompt = `${SECRET_SYSTEM_PROMPT}\n\nUser: ${userPrompt}\nAI:`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        return {
            statusCode: 200,
            body: JSON.stringify({ text: text }),
        };

    } catch (error) {
        console.error("Error in Gemini function:", error);
        // Return error details in development only
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message, stack: error.stack }),
        };
    }
};