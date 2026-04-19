import { useState, useEffect, useRef, useCallback } from 'react';
import chatDB from '../../lib/database';
import { convertMarkdownToPdf } from '../utils/markdownToPdf';
import { useApi } from './useApi';
import { useFileAttachments } from './useFileAttachments';
import { DEFAULT_MODELS } from '../../lib/constants';

// ── Constants ─────────────────────────────────────────────
const CUSTOM_PROMPT_KEY = 'Custom Prompt';
const DEV_KEY_PROVIDER = 'anthropic';
const DEV_KEY_MODEL = DEFAULT_MODELS.anthropic[0];
const TITLE_MAX = 50;
const SCROLL_THRESHOLD = 30;
const CHARS_PER_TOKEN = 4;
const CANCEL_TEXT = 'Request cancelled by user';
const CANCEL_SUFFIX = '\n\n_[cancelled]_';

// ── Pure helpers ──────────────────────────────────────────
const estimateTokens = (s) => {
    const len = (s || '').length;
    return len ? Math.max(1, Math.ceil(len / CHARS_PER_TOKEN)) : 0;
};

const makeChatTitle = (text) => {
    const t = text || '';
    return t.substring(0, TITLE_MAX) + (t.length > TITLE_MAX ? '...' : '');
};

const sanitizeFilename = (name) =>
    (name || 'chat').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim().slice(0, 120) || 'chat';

const buildDbMeta = (userMessage, hasAttachments) => hasAttachments ? {
    displayContent: userMessage.displayContent,
    files: userMessage.files,
    ...(userMessage.images && { images: userMessage.images })
} : undefined;

function parseMarkdownChat(mdText) {
    const text = (mdText || '').replace(/\r\n/g, '\n');
    const titleMatch = text.match(/^# (.+)\n?/);
    const title = titleMatch?.[1].trim() || 'Imported Chat';
    const body = titleMatch ? text.slice(titleMatch[0].length) : text;

    // Split on role headers: [preamble, role1, body1, role2, body2, ...]
    const parts = body.split(/\n?##\s*(User|Assistant)\s*\n/i);
    const messages = [];
    for (let i = 1; i < parts.length; i += 2) {
        const role = parts[i].toLowerCase() === 'user' ? 'user' : 'assistant';
        const content = (parts[i + 1] || '').trim();
        if (content) messages.push({ role, content });
    }
    return { title, messages };
}

function buildPayload({ prompt, history, selectedSystemPrompt, customPrompt, llmSettings }) {
    const payload = {
        prompt,
        history: history.map(m => ({ role: m.role, content: m.content })),
        systemPrompt: selectedSystemPrompt,
        provider: llmSettings.provider,
        apiKey: llmSettings.apiKeys[llmSettings.provider],
        model: llmSettings.models?.[llmSettings.provider] || ''
    };
    if (!llmSettings?.useProviderDefaultTemperature && typeof llmSettings?.temperature === 'number') {
        payload.temperature = llmSettings.temperature;
    }
    if (selectedSystemPrompt === CUSTOM_PROMPT_KEY) payload.customPrompt = customPrompt;
    if (llmSettings.useDeveloperKey) {
        payload.provider = DEV_KEY_PROVIDER;
        payload.model = DEV_KEY_MODEL;
        payload.useDeveloperKey = true;
    }
    return payload;
}

// Replace last assistant bubble's content; append if none or (with mustBeEmpty) if non-empty.
const writeAssistant = (setMessages, text, { mustBeEmpty = false } = {}) => {
    setMessages(prev => {
        const last = prev[prev.length - 1];
        const canReplace = last?.role === 'assistant' && (!mustBeEmpty || !last.content);
        if (canReplace) {
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, content: text };
            return updated;
        }
        return [...prev, { role: 'assistant', content: text }];
    });
};

/**
 * useChat — central chat state and operations.
 * Delegates to: useApi (streaming), useFileAttachments (files).
 */
export default function useChat({ selectedSystemPrompt, customPrompt, llmSettings }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [messagesLoaded, setMessagesLoaded] = useState(true);
    const [usageLast, setUsageLast] = useState(null);
    const [usageTotals, setUsageTotals] = useState({ input: 0, output: 0, total: 0 });
    const [hasRetry, setHasRetry] = useState(false);

    const api = useApi();
    const files = useFileAttachments();

    const chatLogRef = useRef(null);
    const lastUserPromptRef = useRef('');
    const abortedRef = useRef(false);
    // Chats created locally this session — skip the DB reload for these since
    // their in-memory state is authoritative (user msg + streaming assistant).
    const skipLoadForIdRef = useRef(null);

    // ── Effects ────────────────────────────────────────────

    useEffect(() => {
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

    useEffect(() => {
        if (!activeChatId) { setUsageTotals({ input: 0, output: 0, total: 0 }); return; }
        try {
            const raw = localStorage.getItem(`usageTotals:${activeChatId}`);
            const parsed = raw ? JSON.parse(raw) : null;
            setUsageTotals({
                input: Number(parsed?.input) || 0,
                output: Number(parsed?.output) || 0,
                total: Number(parsed?.total) || 0
            });
        } catch (err) {
            console.warn('Failed to load usage totals:', err);
        }
    }, [activeChatId]);

    useEffect(() => {
        if (!activeChatId) return;
        try {
            localStorage.setItem(`usageTotals:${activeChatId}`, JSON.stringify(usageTotals));
        } catch (err) {
            console.warn('Failed to save usage totals:', err);
        }
    }, [activeChatId, usageTotals]);

    useEffect(() => {
        const el = chatLogRef.current;
        if (!el) return;
        if (el.scrollHeight - el.clientHeight <= el.scrollTop + SCROLL_THRESHOLD) {
            requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
        }
    }, [messages]);

    // ── Operations ─────────────────────────────────────────

    const loadChatHistory = useCallback(async () => {
        const chats = await chatDB.getAllChats();
        setChatHistory(chats);
        return chats;
    }, []);

    const clearChat = useCallback(() => {
        setActiveChatId(null);
        setMessages([]);
        setInput('');
    }, []);

    const stopGeneration = useCallback(() => {
        abortedRef.current = true;
        api.abort();
    }, [api]);

    const resend = useCallback(() => {
        setInput(lastUserPromptRef.current || '');
    }, []);

    const deleteChat = useCallback(async (id) => {
        try {
            await chatDB.deleteChat(id);
            setChatHistory(prev => prev.filter(c => c.id !== id));
            if (id === activeChatId) { setActiveChatId(null); setMessages([]); }
            localStorage.removeItem(`usageTotals:${id}`);
        } catch (err) {
            console.error('Failed to delete chat:', err);
        }
    }, [activeChatId]);

    const renameChat = useCallback(async (id, newTitle) => {
        try {
            await chatDB.updateChatTitle(id, newTitle);
            setChatHistory(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
        } catch (err) {
            console.error('Failed to rename chat:', err);
        }
    }, []);

    const downloadChat = useCallback(async (format) => {
        if (format !== 'md' && format !== 'pdf') return;
        const chat = chatHistory.find(c => c.id === activeChatId);
        if (!chat) { alert('No active chat to export.'); return; }

        const header = format === 'md' ? [`# ${chat.title}`, ''] : [];
        const body = messages.flatMap(m => [
            `## ${m.role === 'assistant' ? 'Assistant' : 'User'}`, '', m.content || '', ''
        ]);
        const md = [...header, ...body].join('\n');
        const safeName = sanitizeFilename(chat.title);

        if (format === 'pdf') {
            await convertMarkdownToPdf(md, `${safeName}.pdf`);
            return;
        }
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [activeChatId, chatHistory, messages]);

    const importChat = useCallback(async ({ title, messages: chatMessages }) => {
        const model = llmSettings.models?.[llmSettings.provider] || '';
        const newId = await chatDB.createChat(title, selectedSystemPrompt, llmSettings.provider, model);
        for (const m of chatMessages) {
            await chatDB.addMessage(newId, m.role === 'assistant' ? 'assistant' : 'user', m.content);
        }
        const now = new Date();
        setChatHistory(prev => [...prev, {
            id: newId, title, created: now, updated: now,
            systemPrompt: selectedSystemPrompt, provider: llmSettings.provider, model
        }]);
        setActiveChatId(newId);
        return newId;
    }, [selectedSystemPrompt, llmSettings]);

    const sendMessage = useCallback(async () => {
        if (!input.trim()) return;
        if (activeChatId && !messagesLoaded) {
            alert('Loading chat messages, please try again in a moment.');
            return;
        }

        setHasRetry(false);
        abortedRef.current = false;

        // ── 1. Build user message ────────────────────────────
        const attached = files.attachedFiles;
        const hasText = attached.some(f => f.type === 'text');
        const hasImages = attached.some(f => f.type === 'image');
        const hasAttachments = attached.length > 0;

        const fullPrompt = hasText ? files.formatForPrompt() + '\n\n' + input : input;
        const userMessage = { role: 'user', content: fullPrompt };
        if (hasAttachments) {
            userMessage.displayContent = input;
            userMessage.files = attached.map(f => ({ name: f.name, type: f.type }));
        }
        if (hasImages) {
            userMessage.images = attached
                .filter(f => f.type === 'image')
                .map(f => ({ name: f.name, dataUrl: f.dataUrl }));
        }

        // ── 2. Update UI state ──────────────────────────────
        const priorMessages = messages;
        lastUserPromptRef.current = fullPrompt;
        setMessages([...priorMessages, userMessage]);
        setInput('');
        files.clearFiles();
        setIsLoading(true);

        let chatId = activeChatId;
        const dbMeta = buildDbMeta(userMessage, hasAttachments);

        try {
            // ── 3. Create chat if needed; persist user message ─
            if (!chatId) {
                const title = makeChatTitle(input);
                const model = llmSettings.models?.[llmSettings.provider] || '';
                chatId = await chatDB.createChat(title, selectedSystemPrompt, llmSettings.provider, model);
                // Mark this chat as locally created BEFORE setActiveChatId so the
                // load effect skips the DB reload race (would blank the user msg).
                setActiveChatId(chatId);
                queueMicrotask(() => { skipLoadForIdRef.current = chatId; });
                const now = new Date();
                setChatHistory(prev => [...prev, {
                    id: chatId, title, created: now, updated: now,
                    systemPrompt: selectedSystemPrompt, provider: llmSettings.provider, model
                }]);
            }
            await chatDB.addMessage(chatId, userMessage.role, userMessage.content, dbMeta);

            // ── 4. Build payload + stream ──────────────────────
            // history = prior turns only; current turn is sent via `prompt`
            // (adapters append it after history — duplicating here = double-send).
            const payload = buildPayload({
                prompt: fullPrompt,
                history: priorMessages,
                selectedSystemPrompt, customPrompt, llmSettings
            });
            if (hasImages) payload.images = files.extractImages();

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
            let aiText = '';
            let gotUsage = false;
            let errored = false;

            for await (const event of api.streamEvents(payload)) {
                if (event.type === 'chunk') {
                    aiText += event.text;
                    writeAssistant(setMessages, aiText);
                } else if (event.type === 'usage') {
                    gotUsage = true;
                    setUsageLast(event);
                    setUsageTotals(prev => ({
                        input: prev.input + event.inputTokens,
                        output: prev.output + event.outputTokens,
                        total: prev.total + event.totalTokens
                    }));
                } else if (event.type === 'error') {
                    errored = true;
                    const errText = `[Error] ${event.message}`;
                    writeAssistant(setMessages, errText, { mustBeEmpty: true });
                    try { await chatDB.addMessage(chatId, 'assistant', errText); } catch (err) { console.warn('DB write failed:', err?.message); }
                }
            }

            // ── 5. Handle cancellation ─────────────────────────
            if (abortedRef.current) {
                const finalText = aiText ? aiText + CANCEL_SUFFIX : CANCEL_TEXT;
                writeAssistant(setMessages, finalText);
                try { await chatDB.addMessage(chatId, 'assistant', finalText); } catch (err) { console.warn('DB write failed:', err?.message); }
                return;
            }

            // ── 6. Fallback token estimation ───────────────────
            if (!gotUsage && !errored) {
                const inputText = [
                    priorMessages.map(m => m?.content || '').join('\n'),
                    fullPrompt,
                    selectedSystemPrompt
                ].filter(Boolean).join('\n');
                const inputTokens = estimateTokens(inputText);
                const outputTokens = estimateTokens(aiText);
                setUsageLast({ inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, method: 'estimated' });
                setUsageTotals(prev => ({
                    input: prev.input + inputTokens,
                    output: prev.output + outputTokens,
                    total: prev.total + inputTokens + outputTokens
                }));
            }

            // ── 7. Persist assistant response ──────────────────
            if (!errored && aiText.trim()) {
                await chatDB.addMessage(chatId, 'assistant', aiText);
            }
        } catch (error) {
            console.error('API error during chat request:', error);
            setHasRetry(true);
            const errText = error?.message || 'Unknown error';
            writeAssistant(setMessages, errText, { mustBeEmpty: true });
            if (chatId) {
                try { await chatDB.addMessage(chatId, 'assistant', errText); } catch (err) { console.warn('DB write failed:', err?.message); }
            }
        } finally {
            setIsLoading(false);
        }
    }, [input, activeChatId, messages, messagesLoaded, selectedSystemPrompt, customPrompt, llmSettings, api, files]);

    return {
        messages, input, isLoading, chatHistory, activeChatId,
        messagesLoaded, usageLast, usageTotals, chatLogRef, hasRetry,
        setInput, setActiveChatId, setChatHistory,
        attachedFiles: files.attachedFiles,
        addFiles: files.addFiles,
        removeFile: files.removeFile,
        sendMessage, deleteChat, renameChat, downloadChat, importChat,
        parseMarkdownChat, resend, stopGeneration, clearChat, loadChatHistory,
    };
}
