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

  // Helper to extract text from various response shapes
  const extractText = (resp) => {
    try {
      if (!resp) return '';
      if (typeof resp.text === 'function') return resp.text() || '';
      if (resp.candidates?.length) {
        const parts = resp.candidates[0]?.content?.parts || [];
        return parts.map(p => p?.text || '').join('') || '';
      }
      return '';
    } catch {
      return '';
    }
  };

  // Build model + chat
  const modelClient = genAI.getGenerativeModel({ model, systemInstruction, generationConfig });
  const chat = modelClient.startChat({ history: normalizedHistory, generationConfig });

  // Primary attempt: streaming
  let yieldedAny = false;
  let streamResult;
  try {
    streamResult = await chat.sendMessageStream(prompt);
    for await (const chunk of streamResult.stream) {
      const text = typeof chunk?.text === 'function' ? chunk.text() : extractText(chunk);
      if (typeof text === 'string' && text.trim().length > 0) {
        yieldedAny = true;
        yield text;
      }
    }
  } catch (e) {
    // If the streaming call itself fails, fall through to non-streaming fallback
  }

  // Fallback 1: aggregated response from the streaming call
  if (!yieldedAny && streamResult) {
    try {
      const aggregated = await streamResult.response;
      const fullText = extractText(aggregated);
      if (typeof fullText === 'string' && fullText.trim().length > 0) {
        yieldedAny = true;
        yield fullText;
      }
    } catch {
      // ignore
    }
  }

  // Fallback 2: non-streaming request (single shot)
  if (!yieldedAny) {
    try {
      const single = await chat.sendMessage(prompt);
      const aggregated = await single.response;
      const fullText = extractText(aggregated);
      if (typeof fullText === 'string' && fullText.trim().length > 0) {
        yieldedAny = true;
        yield fullText;
      } else {
        // Inspect for safety block reasons if available
        const blockReason = aggregated?.promptFeedback?.blockReason || aggregated?.candidates?.[0]?.finishReason;
        if (blockReason && String(blockReason).toUpperCase().includes('SAFETY')) {
          throw new Error('Provider=google safety blocked the response.');
        }
      }
    } catch (e) {
      // If even non-streaming fails, continue to final error below
    }
  }

  if (!yieldedAny) {
    throw new Error(`Provider=google produced no text. model=${model}`);
  }
}
