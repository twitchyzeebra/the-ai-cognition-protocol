const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Readable } = require('stream');

// Conditionally import @netlify/functions for production environment
let stream;
try {
  const netlifyFunctions = require("@netlify/functions");
  stream = netlifyFunctions.stream;
} catch (e) {
  stream = (handler) => handler;
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
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
                readableStream.push(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
        }
        // Explicitly end the stream on success
        readableStream.push(null);
    } catch (error) {
        console.error("AI streaming error:", error);
        readableStream.push(`data: ${JSON.stringify({ error: "Error during streaming." })}\n\n`);
        // Explicitly end the stream on error
        readableStream.push(null);
    }
}

// The main handler, wrapped with the Netlify stream utility for production
exports.handler = stream(async (event, context) => {
    // For local development, this is crucial for streaming to work
    if (context && !process.env.NETLIFY) {
        context.callbackWaitsForEmptyEventLoop = false;
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt, history } = JSON.parse(event.body || '{}');

        if (!prompt) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Bad Request: Valid prompt required.' }),
            };
        }

        const readableStream = new Readable({ read() {} });
        
        // Start the AI stream in the background. The handler returns the stream immediately.
        streamAIResponse(prompt, history, readableStream);

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