// NOTE: Using direct HTTP requests instead of @mistralai/mistralai SDK

/**
 * Stream Mistral chat completions via direct HTTP
 * @param {{ apiKey:string, model:string, prompt:string, history:Array<{role:'user'|'assistant'|'system', content:string}>, systemInstruction?:string, temperature?:number }} params
 */
export async function* sendMessageStream({ apiKey, model, prompt, history, systemInstruction, temperature }) {
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  
  if (Array.isArray(history)) {
    for (const m of history) {
      if (!m || typeof m.content !== 'string') continue;
      const role = m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user');
      const raw = m.content;
      const trimmed = raw.trim();
      const content = (role === 'assistant' && trimmed.length === 0) ? '[empty message]' : raw; //Mistral gives an error if there are empty assistant messages (From pressing stop before any message is generated)
      messages.push({ role, content });
    }
  }
  
  messages.push({ role: 'user', content: prompt });

  // Prepare request body
  const requestBody = {
    model,
    messages,
    stream: true
  };
  
  if (typeof temperature === 'number') {
    requestBody.temperature = temperature;
  }

  // Make direct HTTP request to Mistral API
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Mistral API error ${response.status}: ${errorText}`);
  }

  // Parse streaming response
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body from Mistral API');
  }

  const decoder = new TextDecoder();
  let yieldedAny = false;
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      // must remove data prefixes
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        const m = trimmed.match(/^data:\s?(.*)$/);
        if (!m) continue;

        const jsonStr = m[1];
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed?.choices?.[0]?.delta?.content;

          if (typeof delta === 'string' && delta.length > 0) {
            yieldedAny = true;
            yield delta;
          }
        } catch (e) {
          // Likely incomplete JSON; re-buffer original line and wait for more bytes
          buffer = trimmed + "\n" + buffer;
        }
        
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!yieldedAny) {
    throw new Error('Mistral API produced no text output');
  }
}
