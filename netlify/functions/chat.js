const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = process.env.GEMINI_API_KEY;
const SECRET_SYSTEM_PROMPT = process.env.SECRET_SYSTEM_PROMPT;

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

exports.handler = async (event) => {
    // *** THIS IS THE NEW DIAGNOSTIC LINE ***
    console.log("RECEIVED EVENT:", JSON.stringify(event, null, 2));

    // Log environment variable presence (not values)
    console.log("GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);
    console.log("SECRET_SYSTEM_PROMPT present:", !!process.env.SECRET_SYSTEM_PROMPT);

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt: userPrompt } = JSON.parse(event.body);

        if (!userPrompt) {
            return { statusCode: 400, body: 'Bad Request: No prompt provided.' };
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