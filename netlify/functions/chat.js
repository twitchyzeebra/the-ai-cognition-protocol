const { GoogleGenerativeAI } = require("@google/generative-ai");

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
            // For now, return a default prompt if decryption fails
            return "You are a helpful AI assistant.";
        }
        return "You are a helpful AI assistant.";
    } catch (error) {
        console.error('System prompt loading failed:', error);
        return "You are a helpful AI assistant.";
    }
}

// Simple handler without complex streaming
exports.handler = async (event, context) => {
    // Add debugging logs to track execution
    console.log("Function started");
    console.log("Environment Variables:", {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "[SET]" : "[NOT SET]",
        NETLIFY: process.env.NETLIFY ? "[SET]" : "[NOT SET]",
    });

    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers,
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
                headers,
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

        // Collect all chunks
        let fullResponse = '';
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                fullResponse += chunkText;
            }
        }

        console.log("Response complete");
        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                text: fullResponse,
                success: true
            }),
        };

    } catch (error) {
        console.error("Handler error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal Server Error: ' + error.message,
                success: false
            }),
        };
    }
};