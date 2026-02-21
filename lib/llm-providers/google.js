import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @param {{ apiKey:string, model:string, prompt:string, history:Array<{role:string, content:string}>, systemInstruction?:string, temperature?:number }} params
 * @returns {AsyncGenerator<string, void, unknown>}
 */
export async function* sendMessageStream({ apiKey, model, prompt, history, systemInstruction, temperature }) {
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

  // Stream the response
  let yieldedAny = false;
  let usageEmitted = false;

  try {
    const streamResult = await chat.sendMessageStream(prompt);

    for await (const chunk of streamResult.stream) {
      const text = extractText(chunk);
      if (text) {
        yieldedAny = true;
        yield text;
      }
    }

    // Emit usage metadata
    try {
      const response = await streamResult.response;
      const um = response?.usageMetadata;
      if (um && !usageEmitted) {
        const pt = Number(um.promptTokenCount || 0);
        const ct = Number(um.candidatesTokenCount || 0);
        const tt = Number(um.totalTokenCount ?? (pt + ct));
        yield { __usage: { provider: 'google', model, inputTokens: pt, outputTokens: ct, totalTokens: tt, method: 'provider' } };
        usageEmitted = true;
      }
    } catch {}

    if (!yieldedAny) {
      throw new Error(`Provider produced no text. model=${model}`);
    }
  } catch (e) {
    throw e;
  }
}
