/**
 * Yields the data payload of each server-sent event in a fetch Response body.
 * Shared by the browser (reading /api/chat) and the server (reading provider streams).
 * Handles events split across chunks, CRLF line endings, comment lines and multi-byte characters.
 */
export async function* readSSE(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let data = [];
    try {
        for (;;) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split('\n');
            buffer = done ? '' : lines.pop();
            for (const raw of lines) {
                const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
                if (line.startsWith('data:')) data.push(line.slice(line.startsWith('data: ') ? 6 : 5));
                else if (!line && data.length) { yield data.join('\n'); data = []; }
            }
            if (done) {
                if (data.length) yield data.join('\n');
                return;
            }
        }
    } finally {
        // Also runs when the consumer stops early: release the connection.
        reader.cancel().catch(() => {});
    }
}
