import { useCallback, useRef, useState } from 'react';
import { streamChat } from '../utils/streamChat';

/**
 * useApi — handles POST /api/chat, SSE streaming, abort, and retry payload capture.
 *
 * @returns {{
 *   streamEvents: (payload: Object, signal: AbortSignal) => AsyncGenerator,
 *   abort: () => void,
 *   lastError: Object|null,
 *   retryPayload: Object|null,
 *   isStreaming: boolean,
 * }}
 */
export function useApi() {
    const [lastError, setLastError] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);

    // Captured at failure time so "Copy Last" uses the exact payload that failed
    const retryPayloadRef = useRef(null);
    const abortControllerRef = useRef(null);

    /**
     * Async generator that yields typed stream events.
     * Callers consume with: for await (const event of streamEvents(payload, signal)) { ... }
     *
     * @param {Object} payload - The request payload for /api/chat
     * @param {AbortSignal} signal - AbortSignal for cancellation
     * @yields {{ type: 'chunk', text: string } | { type: 'usage', inputTokens: number, outputTokens: number, totalTokens: number } | { type: 'error', message: string } | { type: 'done' }}
     */
    const streamEvents = useCallback(async function* (payload, signal) {
        setIsStreaming(true);
        setLastError(null);
        retryPayloadRef.current = null;

        abortControllerRef.current = new AbortController();

        // Chain client abort with caller's signal
        const onAbort = () => abortControllerRef.current?.abort();
        signal?.addEventListener('abort', onAbort);

        try {
            for await (const event of streamChat(payload, abortControllerRef.current.signal)) {
                if (event.type === 'error') {
                    // Capture payload at failure time for retry
                    retryPayloadRef.current = payload;
                    setLastError({ message: event.message });
                    yield event;
                    continue;
                }
                yield event;
            }
        } catch (error) {
            if (error?.name === 'AbortError') {
                // Abort is intentional — do not set error state
                return;
            }
            retryPayloadRef.current = payload;
            setLastError({ message: error?.message || 'Unknown error' });
            yield { type: 'error', message: error?.message || 'Unknown error' };
        } finally {
            setIsStreaming(false);
            signal?.removeEventListener('abort', onAbort);
            abortControllerRef.current = null;
        }
    }, []);

    const abort = useCallback(() => {
        try {
            abortControllerRef.current?.abort();
        } catch {}
    }, []);

    return {
        streamEvents,
        abort,
        lastError,
        /** Payload that caused the last error — use with "Copy Last" */
        getRetryPayload: () => retryPayloadRef.current,
        isStreaming,
    };
}
