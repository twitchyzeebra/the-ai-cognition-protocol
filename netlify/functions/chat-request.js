const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

// This is a simplified in-memory store. For production, you'd use a database.
const responseStore = new Map();

function decryptSystemPrompt(encryptedData, password) {
    try {
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(password, 'hex');
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

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    if (!API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error." }) };
    }

    try {
        const { prompt: userPrompt } = JSON.parse(event.body || '{}');
        if (!userPrompt) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Bad Request: Valid prompt required.' }) };
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
        const requestId = crypto.randomBytes(16).toString('hex');

        // Don't await this. Let it run in the background.
        model.generateContentStream(fullPrompt)
            .then(resultStream => {
                responseStore.set(requestId, resultStream.stream);
                console.log(`[${requestId}] AI stream started and stored.`);
            })
            .catch(err => {
                console.error(`[${requestId}] Error generating content stream:`, err);
                responseStore.set(requestId, { error: 'Failed to start AI stream.' });
            });

        return {
            statusCode: 202, // Accepted
            body: JSON.stringify({ requestId }),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error) {
        console.error(`Handler error:`, error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
