import { useState, useEffect, useRef, useCallback } from 'react';
import chatDB from '../../lib/database';
import { readSSE } from '../../lib/sse';
import { convertMarkdownToPdf } from '../utils/markdownToPdf';
import { downloadText, safeFilename } from '../utils/helpers';
import { useFileAttachments } from './useFileAttachments';
import { DEV_KEY_PROVIDER, DEV_KEY_MODEL, isCustomPromptSelection } from '../../lib/constants';

const TITLE_MAX = 50;
const SCROLL_THRESHOLD = 30;
const CANCEL_TEXT = 'Request cancelled by user';
const CANCEL_SUFFIX = '\n\n_[cancelled]_';
const EMPTY_USAGE = { input: 0, output: 0, total: 0 };

const estimateTokens = (s) => (s ? Math.max(1, Math.ceil(s.length / 4)) : 0);
const usageKey = (chatId) => `usageTotals:${chatId}`;

function readUsage(chatId) {
    try {
        const saved = JSON.parse(localStorage.getItem(usageKey(chatId)));
        return { input: Number(saved?.input) || 0, output: Number(saved?.output) || 0, total: Number(saved?.total) || 0 };
    } catch {
        return EMPTY_USAGE;
    }
}

/** Parses a chat exported by downloadChat: optional '# Title', then '## User' / '## Assistant' sections. */
function parseMarkdownChat(mdText) {
    const text = (mdText || '').replace(/\r\n/g, '\n');
    const titleMatch = text.match(/^# (.+)\n?/);
    const body = titleMatch ? text.slice(titleMatch[0].length) : text;
    // Split on role headers: [preamble, role1, body1, role2, body2, ...]
    const parts = body.split(/\n?##\s*(User|Assistant)\s*\n/i);
    const messages = [];
    for (let i = 1; i < parts.length; i += 2) {
        const content = (parts[i + 1] || '').trim();
        if (content) messages.push({ role: parts[i].toLowerCase() === 'user' ? 'user' : 'assistant', content });
    }
    return { title: titleMatch?.[1].trim() || 'Imported Chat', messages };
}

/** Provider/model the next request will actually use (dev key overrides both). */
export function resolveTarget(settings = {}) {
    if (settings.useDeveloperKey) return { provider: DEV_KEY_PROVIDER, model: DEV_KEY_MODEL, devKey: true };
    const provider = settings.provider || 'google';
    return { provider, model: settings.models?.[provider] || '', devKey: false };
}

function buildPayload({ prompt, history, selectedSystemPrompt, customPrompt, llmSettings = {} }) {
    const target = resolveTarget(llmSettings);
    const payload = {
        prompt,
        history: history.map(m => ({ role: m.role, content: m.content })),
        systemPrompt: selectedSystemPrompt,
        provider: target.provider,
        apiKey: target.devKey ? '' : llmSettings.apiKeys?.[target.provider] || '',
        model: target.model
    };
    if (!llmSettings.useProviderDefaultTemperature && typeof llmSettings.temperature === 'number') payload.temperature = llmSettings.temperature;
    if (llmSettings.efforts?.[target.provider]) payload.effort = llmSettings.efforts[target.provider];
    if (isCustomPromptSelection(selectedSystemPrompt)) payload.customPrompt = customPrompt || '';
    if (target.devKey) payload.useDeveloperKey = true;
    return payload;
}

/** POSTs to /api/chat and yields its SSE events; HTTP and server-sent errors are thrown. */
async function* streamChat(payload, signal) {
    const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal
    });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data
            ? data.error || data.message || `API request failed with status ${res.status}`
            : `API request failed: ${res.status} ${res.statusText}`);
    }
    if (!res.body) throw new Error('Response body is null');
    for await (const data of readSSE(res.body)) {
        let event;
        try { event = JSON.parse(data); } catch { continue; }
        if (event?.type === 'error') throw new Error(event.message || 'Unknown streaming error');
        if (event?.type) yield event;
    }
}

// Replace the last assistant bubble's content; append a new one if there is none (or, with mustBeEmpty, if it has text).
const writeAssistant = (setMessages, text, { mustBeEmpty = false, extra } = {}) => setMessages(prev => {
    const last = prev[prev.length - 1];
    if (last?.role === 'assistant' && (!mustBeEmpty || !last.content)) return [...prev.slice(0, -1), { ...last, content: text, ...extra }];
    return [...prev, { role: 'assistant', content: text, ...extra }];
});

/**
 * useChat — chat list, active chat messages, streaming, usage tracking, import/export, attachments.
 * @param {{ selectedSystemPrompt: string, customPrompt: string, llmSettings: object }} props
 *   customPrompt = text of the currently selected custom prompt (ignored for built-ins)
 */
export default function useChat({ selectedSystemPrompt, customPrompt, llmSettings }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [activeChatId, setActiveChatIdState] = useState(null);
    const [messagesLoaded, setMessagesLoaded] = useState(true);
    const [usageLast, setUsageLast] = useState(null);
    const [usageTotals, setUsageTotals] = useState(EMPTY_USAGE);
    const [hasRetry, setHasRetry] = useState(false);
    const [notice, setNotice] = useState('');

    const files = useFileAttachments();
    const chatLogRef = useRef(null);
    const lastUserPromptRef = useRef('');
    const abortRef = useRef(null);
    // Mirrors activeChatId synchronously, so a stream only writes into the chat it belongs to.
    const activeIdRef = useRef(null);
    // Chat created by sendMessage: its in-memory messages (user turn + streaming reply) are authoritative.
    const skipLoadForIdRef = useRef(null);

    const setActiveChatId = useCallback((id) => {
        activeIdRef.current = id;
        setActiveChatIdState(id);
    }, []);

    useEffect(() => {
        setUsageTotals(activeChatId ? readUsage(activeChatId) : EMPTY_USAGE);
        if (!activeChatId) { setMessages([]); setMessagesLoaded(true); return; }
        if (skipLoadForIdRef.current === activeChatId) {
            skipLoadForIdRef.current = null;
            setMessagesLoaded(true);
            return;
        }
        let cancelled = false;
        setMessagesLoaded(false);
        chatDB.getChatMessages(activeChatId)
            .then(msgs => { if (!cancelled) setMessages(msgs); })
            .catch(err => { if (!cancelled) { console.error('Failed to load chat messages:', err); setMessages([]); } })
            .finally(() => { if (!cancelled) setMessagesLoaded(true); });
        return () => { cancelled = true; };
    }, [activeChatId]);

    // Keep following the conversation unless the user scrolled up.
    useEffect(() => {
        const el = chatLogRef.current;
        if (el && el.scrollHeight - el.clientHeight <= el.scrollTop + SCROLL_THRESHOLD) {
            requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
        }
    }, [messages]);

    // Adds to the chat's persisted totals; the display updates only if that chat is still open.
    const recordUsage = useCallback((chatId, { inputTokens, outputTokens, totalTokens }) => {
        const last = { inputTokens: Number(inputTokens) || 0, outputTokens: Number(outputTokens) || 0, totalTokens: Number(totalTokens) || 0 };
        setUsageLast(last);
        const prev = readUsage(chatId);
        const next = { input: prev.input + last.inputTokens, output: prev.output + last.outputTokens, total: prev.total + last.totalTokens };
        try { localStorage.setItem(usageKey(chatId), JSON.stringify(next)); } catch (err) { console.warn('Failed to save usage totals:', err); }
        if (activeIdRef.current === chatId) setUsageTotals(next);
    }, []);

    const createChat = useCallback(async (title, initialMessages) => {
        const { provider, model } = resolveTarget(llmSettings);
        const id = await chatDB.createChat(title, selectedSystemPrompt, provider, model, initialMessages);
        const now = new Date();
        setChatHistory(prev => [...prev, { id, title, created: now, updated: now, systemPrompt: selectedSystemPrompt, provider, model }]);
        return id;
    }, [selectedSystemPrompt, llmSettings]);

    const loadChatHistory = useCallback(async () => {
        const chats = await chatDB.getAllChats();
        setChatHistory(chats);
        return chats;
    }, []);

    const clearChat = useCallback(() => {
        setActiveChatId(null);
        setMessages([]);
        setInput('');
        setNotice('');
    }, [setActiveChatId]);

    const stopGeneration = useCallback(() => abortRef.current?.abort(), []);
    const resend = useCallback(() => setInput(lastUserPromptRef.current || ''), []);

    const deleteChat = useCallback(async (id) => {
        try {
            await chatDB.deleteChat(id);
            setChatHistory(prev => prev.filter(c => c.id !== id));
            if (id === activeIdRef.current) { setActiveChatId(null); setMessages([]); }
            localStorage.removeItem(usageKey(id));
        } catch (err) {
            console.error('Failed to delete chat:', err);
        }
    }, [setActiveChatId]);

    const renameChat = useCallback(async (id, title) => {
        try {
            await chatDB.updateChatTitle(id, title);
            setChatHistory(prev => prev.map(c => (c.id === id ? { ...c, title } : c)));
        } catch (err) {
            console.error('Failed to rename chat:', err);
        }
    }, []);

    const downloadChat = useCallback(async (format) => {
        const chat = chatHistory.find(c => c.id === activeChatId);
        if (!chat) { alert('No active chat to export.'); return; }
        const body = messages.flatMap(m => [`## ${m.role === 'assistant' ? 'Assistant' : 'User'}`, '', m.content || '', '']).join('\n');
        const name = safeFilename(chat.title, 'chat');
        try {
            if (format === 'pdf') await convertMarkdownToPdf(body, `${name}.pdf`);
            else downloadText(`# ${chat.title}\n\n${body}`, `${name}.md`, 'text/markdown');
        } catch (err) {
            console.error('Failed to export chat:', err);
            alert(`Failed to export chat: ${err.message}`);
        }
    }, [activeChatId, chatHistory, messages]);

    /** Imports a chat exported by downloadChat and opens it. Returns false if it has no messages. */
    const importMarkdown = useCallback(async (text) => {
        const { title, messages: imported } = parseMarkdownChat(text);
        if (!imported.length) return false;
        setActiveChatId(await createChat(title, imported));
        return true;
    }, [createChat, setActiveChatId]);

    const sendMessage = useCallback(async () => {
        const ready = files.readyFiles;
        if (!input.trim() && !ready.length) return;
        if (files.isProcessing) { setNotice('Still reading attachments. Wait a moment and send again.'); return; }
        if (activeChatId && !messagesLoaded) { alert('Loading chat messages, please try again in a moment.'); return; }

        setHasRetry(false);
        setNotice('');

        // ── Build the user turn: text/document attachments are inlined as <file> blocks.
        const textFiles = ready.filter(f => f.type !== 'image');
        const imageFiles = ready.filter(f => f.type === 'image');
        const typed = input.trim() ? input : ready.length ? 'See the attached file(s).' : input;
        const prompt = textFiles.length ? `${textFiles.map(f => `<file name="${f.name}">\n${f.content}\n</file>`).join('\n\n')}\n\n${typed}` : typed;
        const meta = ready.length ? {
            displayContent: typed,
            files: ready.map(f => ({ name: f.name, type: f.type })),
            ...(imageFiles.length && { images: imageFiles.map(f => ({ name: f.name, dataUrl: f.dataUrl })) })
        } : undefined;

        const prior = messages;
        lastUserPromptRef.current = typed;
        setMessages([...prior, { role: 'user', content: prompt, ...meta }]);
        setInput('');
        files.clearFiles();
        setIsLoading(true);
        const controller = new AbortController();
        abortRef.current = controller;

        let chatId = activeChatId;
        const write = (text, opts) => { if (activeIdRef.current === chatId) writeAssistant(setMessages, text, opts); };
        const persist = (text, extra) => chatDB.addMessage(chatId, 'assistant', text, extra)
            .catch(err => console.warn('DB write failed:', err?.message));

        try {
            if (!chatId) {
                chatId = await createChat(typed.substring(0, TITLE_MAX) + (typed.length > TITLE_MAX ? '...' : ''));
                if (activeIdRef.current === null) { // unless the user opened another chat meanwhile
                    skipLoadForIdRef.current = chatId;
                    setActiveChatId(chatId);
                }
            }
            await chatDB.addMessage(chatId, 'user', prompt, meta);

            // history = prior turns only; the current turn is sent as `prompt`.
            const payload = buildPayload({ prompt, history: prior, selectedSystemPrompt, customPrompt, llmSettings });
            if (imageFiles.length) payload.images = imageFiles.map(f => ({ mimeType: f.mimeType, data: f.dataUrl.split(',')[1] }));

            write('');
            let text = '';
            let servedModel = payload.model;
            let gotUsage = false;
            let errored = false;
            try {
                for await (const event of streamChat(payload, controller.signal)) {
                    if ((event.type === 'start' || event.type === 'usage') && event.model) servedModel = event.model;
                    if (event.type === 'chunk' && typeof event.text === 'string') {
                        text += event.text;
                        write(text);
                    } else if (event.type === 'usage') {
                        gotUsage = true;
                        recordUsage(chatId, event);
                    } else if (event.type === 'notice' && typeof event.message === 'string') {
                        setNotice(event.message);
                    }
                }
            } catch (err) {
                if (err?.name !== 'AbortError') {
                    errored = true;
                    const errText = `[Error] ${err?.message || 'Unknown error'}`;
                    write(errText, { mustBeEmpty: true });
                    await persist(errText);
                }
            }

            if (controller.signal.aborted) {
                const finalText = text ? text + CANCEL_SUFFIX : CANCEL_TEXT;
                write(finalText);
                await persist(finalText);
                return;
            }
            if (!gotUsage && !errored) {
                const inputTokens = estimateTokens([prior.map(m => m?.content || '').join('\n'), prompt, selectedSystemPrompt].filter(Boolean).join('\n'));
                const outputTokens = estimateTokens(text);
                recordUsage(chatId, { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens });
            }
            if (!errored && text.trim()) {
                write(text, { extra: { model: servedModel } });
                await chatDB.addMessage(chatId, 'assistant', text, { model: servedModel });
            }
        } catch (error) {
            console.error('API error during chat request:', error);
            setHasRetry(true);
            const errText = error?.message || 'Unknown error';
            write(errText, { mustBeEmpty: true });
            if (chatId) await persist(errText);
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
            setIsLoading(false);
        }
    }, [input, activeChatId, messages, messagesLoaded, selectedSystemPrompt, customPrompt, llmSettings, files, createChat, recordUsage, setActiveChatId]);

    return {
        messages, input, isLoading, chatHistory, activeChatId, messagesLoaded, usageLast, usageTotals,
        chatLogRef, hasRetry, notice, files,
        setInput, setActiveChatId, setChatHistory, setNotice,
        sendMessage, deleteChat, renameChat, downloadChat, importMarkdown, resend, stopGeneration, clearChat, loadChatHistory
    };
}
