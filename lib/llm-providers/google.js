import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @param {{ apiKey:string, model:string, prompt:string, history:Array<{role:string, content:string}>, systemInstruction?:string, temperature?:number }} params
 * @returns {AsyncGenerator<string, void, unknown>}
 */
export async function* sendMessageStream({ apiKey, model, prompt, history, systemInstruction, temperature }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const normalizedHistory = (history || []).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const generationConfig = typeof temperature === 'number' ? { temperature } : undefined;
  const chat = genAI
    .getGenerativeModel({ model, systemInstruction, generationConfig })
    .startChat({ history: normalizedHistory, generationConfig });
  const result = await chat.sendMessageStream(prompt);

  let yieldedAny = false;
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (typeof text === 'string' && text.length) {
      yieldedAny = true;
      yield text;
    }
  }
  if (!yieldedAny) {
    throw new Error(`Provider=google produced no text. model=${model}`);
  }
}
