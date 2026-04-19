import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @param {{ apiKey:string, model:string, prompt:string, history:Array<{role:string, content:string}>, systemInstruction?:string, temperature?:number }} params
 * @returns {AsyncGenerator<string, void, unknown>}
 */
export async function* sendMessageStream({ apiKey, model, prompt, history, systemInstruction, temperature, images }) {
  const genAI = new GoogleGenerativeAI(apiKey);

  // Normalize chat history to Gemini format
  const normalizedHistory = (history || []).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: String(m.content ?? '') }]
  }));

  const generationConfig = typeof temperature === 'number' ? { temperature } : undefined;

  // Helper to extract text from Gemini response
  const extractText = (resp) => {
    if (!resp?.candidates?.length) return '';
    const parts = resp.candidates[0]?.content?.parts || [];
    return parts.map(p => p?.text || '').join('').trim();
  };

  // Setup model and chat
  const modelClient = genAI.getGenerativeModel({ model, systemInstruction, generationConfig });
  const chat = modelClient.startChat({ history: normalizedHistory, generationConfig });

  // Build current message parts — multimodal if images are attached
  const messageParts = [];
  if (Array.isArray(images) && images.length > 0) {
    for (const img of images) {
      messageParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
  }
  messageParts.push({ text: prompt });

  // Stream the response
  let yieldedAny = false;
  let usageEmitted = false;

  try {
    const streamResult = await chat.sendMessageStream(messageParts);

    for await (const chunk of streamResult.stream) {
      const text = extractText(chunk);
      if (text) {
        yieldedAny = true;
        yield text;
      }
    }

    if (!yieldedAny) {
      throw new Error(`Google API produced no text. model=${model}`);
    }
  } catch (e) {
    throw e;
  }
}
