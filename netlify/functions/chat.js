const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Readable } = require('stream');

// Conditionally import @netlify/functions for production environment
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
    throw new Error("GEMINI_API_KEY environment variable not set.");
}
const genAI = new GoogleGenerativeAI(API_KEY);

// System prompt loader
const { loadSystemPrompt } = require('./_systemPrompt');

// This function handles the core logic of streaming the AI response
async function streamAIResponse(prompt, history, readableStream) {
    try {
        // Send an initial SSE comment to keep the connection alive
        readableStream.push(': ping\n\n');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        // Always inject the system prompt as the first message in the history
        let sysPrompt;
        try {
            sysPrompt = loadSystemPrompt();
        } catch (e) {
            console.error('System prompt error:', e);
            sysPrompt = null;
        }
        let fullHistory = Array.isArray(history) ? [...history] : [];
        // Gemini requires the first message to be from 'user'.
        if (sysPrompt) {
            if (!fullHistory.length || fullHistory[0].role !== 'user') {
                fullHistory.unshift({ role: 'user', parts: [{ text: sysPrompt }] });
            }
        }
        const chat = model.startChat({
            history: fullHistory,
        });
        const result = await chat.sendMessageStream(prompt);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                // SSE format: data: { ... } \n\n
                readableStream.push(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
        }
        // Signal the end of the stream to the client
        readableStream.push('data: [DONE]\n\n');

    } catch (error) {
        console.error("AI streaming error:", error);
        // Send a structured error message to the client
        readableStream.push(`data: ${JSON.stringify({ error: "An error occurred while communicating with the AI." })}\n\n`);
    } finally {
        // Always close the stream
        readableStream.push(null);
    }
}

// Add input validation and sanitization
function validateAndSanitizeInput(prompt, history) {
    if (typeof prompt !== 'string' || !prompt.trim()) {
        throw new Error('Invalid prompt: Prompt must be a non-empty string.');
    }

    if (!Array.isArray(history)) {
        throw new Error('Invalid history: History must be an array.');
    }

    // Limit history length to prevent abuse
    const maxHistoryLength = 10;
    if (history.length > maxHistoryLength) {
        history = history.slice(-maxHistoryLength);
    }

    return { prompt: prompt.trim(), history };
}

// The main handler, wrapped with the Netlify stream utility
exports.handler = stream(async (event, context) => {
    // For local development, this is crucial for streaming to work
    if (context && !process.env.NETLIFY) {
        context.callbackWaitsForEmptyEventLoop = false;
    }

    // Add debugging logs to track execution
    console.log("Event received:", event);
    console.log("Context received:", context);

    // Log environment variables for debugging
    console.log("Environment Variables:", {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "[SET]" : "[NOT SET]",
        NETLIFY: process.env.NETLIFY ? "[SET]" : "[NOT SET]",
    });

    // The frontend now sends POST requests with a JSON body.
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Using a Promise to handle the async streaming operation
    return new Promise((resolve, reject) => {
        try {
            // Parse and validate the prompt and history from the request body
            const body = JSON.parse(event.body);
            const { prompt, history } = validateAndSanitizeInput(body.prompt, body.history || []);

            const readableStream = new Readable({ read() {} });

            // Start the AI stream in the background. The handler returns the stream immediately.
            streamAIResponse(prompt, history, readableStream);

            resolve({
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
                body: readableStream,
            });
        } catch (error) {
            console.error("Handler error:", error);
            // This will be caught by the promise's reject and handled below
            reject(error);
        }
    }).catch(error => {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message }),
        };
    });
});