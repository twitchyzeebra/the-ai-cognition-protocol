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

// The main handler, wrapped with the Netlify stream utility
exports.handler = stream(async (event, context) => {
    // For local development, this is crucial for streaming to work
    if (context && !process.env.NETLIFY) {
        context.callbackWaitsForEmptyEventLoop = false;
    }

    // The frontend now sends POST requests with a JSON body.
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Parse the prompt and history from the request body
        const body = JSON.parse(event.body);
        const { prompt, history } = body;

        if (!prompt) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Bad Request: Prompt is required.' }),
            };
        }

        // History is already a parsed object from the body, no need for decode/parse.

        const readableStream = new Readable({ read() {} });
        
        // Start the AI stream in the background. The handler returns the stream immediately.
        streamAIResponse(prompt, history || [], readableStream);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
            body: readableStream,
        };

    } catch (error) {
        console.error("Handler error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
        };
    }
});