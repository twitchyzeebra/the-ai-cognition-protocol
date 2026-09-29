import { GoogleGenerativeAI } from '@google/generative-ai';

/** Stream Gemini. See app/api/chat/route.js for the adapter contract. */
export async function* sendMessageStream({ apiKey, model, prompt, history, systemInstruction, temperature, images, signal }) {
  const generationConfig = typeof temperature === 'number' ? { temperature } : undefined;
  const chat = new GoogleGenerativeAI(apiKey)
    .getGenerativeModel({ model, systemInstruction, generationConfig })
    .startChat({ history: history.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })), generationConfig });
  const parts = [...(images || []).map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })), { text: prompt }];

  const { stream } = await chat.sendMessageStream(parts, { signal });
  let yielded = false;
  for await (const chunk of stream) {
    // Not trimmed: chunk boundaries often fall on spaces and paragraph breaks.
    const text = (chunk.candidates?.[0]?.content?.parts || []).map(p => p?.text || '').join('');
    if (text) {
      yielded = true;
      yield text;
    }
  }
  if (!yielded) throw new Error(`Google API produced no text. model=${model}`);
}
