/**
 * Pure async generator for streaming chat responses via SSE.
 * No React dependency — this is a utility function.
 *
 * @param {Object} payload - The request payload for /api/chat
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
 * @yields {{ type: 'chunk', text: string } | { type: 'usage', inputTokens: number, outputTokens: number, totalTokens: number } | { type: 'done' }}
 * @throws {Error} On HTTP failure or server-sent error events
 */
export async function* streamChat(payload, signal) {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
    });

    if (!response.ok) {
        let errorMessage = `API request failed with status ${response.status}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
            errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
    }

    if (!response.body) {
        throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    /**
     * Parse a single SSE event block into a typed event object.
     * Returns the event object to yield, or null if the block is not actionable.
     */
    function parseEvent(eventText) {
        const lines = eventText.replace(/\r/g, '').split('\n');
        const dataLines = [];
        for (const raw of lines) {
            if (raw.startsWith('data:')) {
                dataLines.push(raw.slice(5).trimStart());
            }
        }
        if (dataLines.length === 0) return null;

        let json;
        try {
            json = JSON.parse(dataLines.join('\n'));
        } catch {
            return null;
        }

        if (json.type === 'chunk' && typeof json.text === 'string') {
            return { type: 'chunk', text: json.text };
        }
        if (json.type === 'usage') {
            return {
                type: 'usage',
                inputTokens: Number(json.inputTokens || 0),
                outputTokens: Number(json.outputTokens || 0),
                totalTokens: Number(json.totalTokens || 0),
            };
        }
        if (json.type === 'error') {
            throw new Error(json.message || 'Unknown streaming error');
        }
        if (json.type === 'done') {
            return { type: 'done' };
        }
        return null;
    }

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (buffer.trim().length > 0) {
                    const event = parseEvent(buffer);
                    if (event) yield event;
                }
                break;
            }
            buffer += decoder.decode(value, { stream: true });

            let sepIndex;
            while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
                const eventBlock = buffer.slice(0, sepIndex);
                buffer = buffer.slice(sepIndex + 2);
                const event = parseEvent(eventBlock);
                if (event) yield event;
            }
        }
    } finally {
        reader.releaseLock();
    }
}
