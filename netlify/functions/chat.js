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
    // This will cause the function to fail gracefully if the key is missing
    throw new Error("GEMINI_API_KEY environment variable not set.");
}
const genAI = new GoogleGenerativeAI(API_KEY);

// This function handles the core logic of streaming the AI response
async function streamAIResponse(prompt, history, readableStream) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const chat = model.startChat({
            history: history || [],
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