import { useState, useEffect, useRef, useCallback } from 'react';
import chatDB from '../../lib/database';
import { convertMarkdownToPdf } from '../utils/markdownToPdf';
import { streamChat } from '../utils/streamChat';

/**
 * Custom hook encapsulating all chat-domain state and operations.
 * Owns: messages, chat history, streaming, usage tracking, import/export.
 *
 * @param {{ selectedSystemPrompt: string, customPrompt: string, llmSettings: Object }} params
 */
export default function useChat({ selectedSystemPrompt, customPrompt, llmSettings }) {
    // ── State ──────────────────────────────────────────────
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [messagesLoaded, setMessagesLoaded] = useState(true);
    const [usageLast, setUsageLast] = useState(null);
    const [usageTotals, setUsageTotals] = useState({ input: 0, output: 0, total: 0 });
    const [hasRetry, setHasRetry] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState([]);

    // ── Refs ───────────────────────────────────────────────
    const chatLogRef = useRef(null);
    const inflightControllerRef = useRef(null);
    const retryStateRef = useRef(null);
    const receivedUsageRef = useRef(false);
    const lastUserPromptRef = useRef('');
    const lastTurnHistorySnapshotRef = useRef([]);

    // ── Effects ────────────────────────────────────────────

    // Load messages when active chat changes
    useEffect(() => {
        const loadMessages = async () => {
            if (activeChatId) {
                setMessagesLoaded(false);
                try {
                    const msgs = await chatDB.getChatMessages(activeChatId);
                    setMessages(msgs);
                } catch (error) {
                    console.error('Failed to load chat messages:', error);
                    setMessages([]);
                } finally {
                    setMessagesLoaded(true);
                }
            } else {
                setMessages([]);
                setMessagesLoaded(true);
            }
        };
        loadMessages();
    }, [activeChatId]);

    // Load per-chat usage totals from localStorage
    useEffect(() => {
        if (!activeChatId) {
            setUsageTotals({ input: 0, output: 0, total: 0 });
            return;
        }
        try {
            const raw = localStorage.getItem(`usageTotals:${activeChatId}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                setUsageTotals({
                    input: Number(parsed.input) || 0,
                    output: Number(parsed.output) || 0,
                    total: Number(parsed.total) || 0
                });
            } else {
                setUsageTotals({ input: 0, output: 0, total: 0 });
            }
        } catch (error) {
            console.warn('Failed to load usage totals:', error);
        }
    }, [activeChatId]);

    // Persist usage totals per chat
    useEffect(() => {
        if (!activeChatId) return;
        try {
            localStorage.setItem(`usageTotals:${activeChatId}`, JSON.stringify(usageTotals));
        } catch (error) {
            console.warn('Failed to save usage totals:', error);
        }
    }, [activeChatId, usageTotals]);

    // Auto-scroll chat log to bottom when near the bottom
    useEffect(() => {
        const chatLog = chatLogRef.current;
        if (!chatLog) return;
        const wasAtBottom = chatLog.scrollHeight - chatLog.clientHeight <= chatLog.scrollTop + 30;
        if (wasAtBottom) {
            requestAnimationFrame(() => {
                chatLog.scrollTop = chatLog.scrollHeight;
            });
        }
    }, [messages]);

    // Abort in-flight request on unmount
    useEffect(() => {
        return () => {
            try { inflightControllerRef.current?.abort(); } catch {}
        };
    }, []);

    // ── Helpers ────────────────────────────────────────────

    function buildPayload(promptText, priorMessages) {
        const payload = {
            prompt: promptText,
            history: priorMessages.map(m => ({ role: m.role, content: m.content })),
            systemPrompt: selectedSystemPrompt,
            provider: llmSettings.provider,
            apiKey: llmSettings.apiKeys[llmSettings.provider],
            model: (llmSettings.models?.[llmSettings.provider] || '')
        };
        if (!llmSettings?.useProviderDefaultTemperature && typeof llmSettings?.temperature === 'number') {
            payload.temperature = llmSettings.temperature;
        }
        if (selectedSystemPrompt === 'Custom Prompt') {
            payload.customPrompt = customPrompt;
        }
        if (llmSettings.useDeveloperKey) {
            payload.provider = 'anthropic';
            payload.model = 'claude-opus-4-6';
            payload.useDeveloperKey = true;
        }
        return payload;
    }

    function parseMarkdownChat(mdText) {
        const text = (mdText || '').replace(/\r\n/g, '\n');
        const lines = text.split('\n');
        let idx = 0;
        let title = 'Imported Chat';
        if (lines[0] && lines[0].startsWith('# ')) {
            title = lines[0].slice(2).trim() || title;
            idx = 1;
        }
        const parsed = [];
        let currentRole = null;
        let buffer = [];
        const flush = () => {
            if (currentRole) {
                const content = buffer.join('\n').trim();
                if (content) parsed.push({ role: currentRole, content });
            }
            buffer = [];
        };
        for (; idx < lines.length; idx++) {
            const line = lines[idx];
            const m = line.match(/^##\s*(User|Assistant)\s*$/i);
            if (m) {
                flush();
                currentRole = m[1].toLowerCase() === 'user' ? 'user' : 'assistant';
                buffer = [];
            } else {
                buffer.push(line);
            }
        }
        flush();
        return { title, messages: parsed };
    }

    const TEXT_EXTENSIONS = ['.txt', '.md'];
    const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const MAX_TEXT_SIZE = 2000 * 1024;       // 2MB for text files
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images

    const addFiles = useCallback((fileList) => {
        const readPromises = [];
        for (const file of fileList) {
            const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
            if (TEXT_EXTENSIONS.includes(ext)) {
                if (file.size > MAX_TEXT_SIZE) {
                    alert(`File too large: ${file.name} (${(file.size / 1024).toFixed(1)}KB). Max text file size is 100KB.`);
                    continue;
                }
                readPromises.push(file.text().then(content => ({ name: file.name, content, type: 'text' })));
            } else if (IMAGE_EXTENSIONS.includes(ext)) {
                if (file.size > MAX_IMAGE_SIZE) {
                    alert(`Image too large: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max image size is 5MB.`);
                    continue;
                }
                readPromises.push(new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({ name: file.name, dataUrl: reader.result, mimeType: file.type || 'image/png', type: 'image' });
                    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
                    reader.readAsDataURL(file);
                }));
            } else {
                alert(`Unsupported file type: ${file.name}. Supported: .txt, .md, .png, .jpg, .jpeg, .gif, .webp`);
            }
        }
        if (readPromises.length === 0) return;
        Promise.all(readPromises).then(results => {
            setAttachedFiles(prev => [...prev, ...results]);
        });
    }, []);

    const removeFile = useCallback((index) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    function formatAttachedFiles(files) {
        const textFiles = files.filter(f => f.type === 'text');
        if (!textFiles.length) return '';
        return textFiles.map(f =>
            `<file name="${f.name}">\n${f.content}\n</file>`
        ).join('\n\n');
    }

    const estimateTokens = (s) => {
        const len = (s || '').length;
        return len ? Math.max(1, Math.ceil(len / 4)) : 0;
    };

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
        try { inflightControllerRef.current?.abort(); } catch {}
    }, []);

    const resend = useCallback(() => {
        setInput(lastUserPromptRef.current || '');
    }, []);

    const deleteChat = useCallback(async (id) => {
        try {
            await chatDB.deleteChat(id);
            setChatHistory(prev => prev.filter(chat => chat.id !== id));
            setActiveChatId(prev => prev === id ? null : prev);
            if (activeChatId === id) {
                setMessages([]);
            }
        } catch (error) {
            console.error('Failed to delete chat:', error);
        }
    }, [activeChatId]);

    const renameChat = useCallback(async (id, newTitle) => {
        try {
            await chatDB.updateChatTitle(id, newTitle);
            setChatHistory(prev => prev.map(chat =>
                chat.id === id ? { ...chat, title: newTitle } : chat
            ));
        } catch (error) {
            console.error('Failed to rename chat:', error);
        }
    }, []);

    const downloadChat = useCallback(async (format) => {
        if (format !== 'md' && format !== 'pdf') return;
        if (!activeChatId) {
            alert('No active chat to export.');
            return;
        }
        const activeChat = chatHistory.find(c => c.id === activeChatId);
        if (!activeChat) {
            alert('No active chat to export.');
            return;
        }
        const lines = [];
        if (format === 'md') {
            lines.push(`# ${activeChat.title}`);
            lines.push('');
        }
        for (const m of messages) {
            lines.push(`## ${m.role === 'assistant' ? 'Assistant' : 'User'}`);
            lines.push('');
            lines.push(m.content || '');
            lines.push('');
        }
        const md = lines.join('\n');

        if (format === 'pdf') {
            await convertMarkdownToPdf(md, `${activeChat.title}.pdf`);
        } else {
            const blob = new Blob([md], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${activeChat.title}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }, [activeChatId, chatHistory, messages]);

    const importChat = useCallback(async ({ title, messages: chatMessages }) => {
        const newId = await chatDB.createChat(
            title,
            selectedSystemPrompt,
            llmSettings.provider,
            (llmSettings.models?.[llmSettings.provider] || '')
        );
        for (const m of chatMessages) {
            await chatDB.addMessage(newId, m.role === 'assistant' ? 'assistant' : 'user', m.content);
        }
        const now = new Date();
        const newChat = {
            id: newId,
            title,
            created: now,
            updated: now,
            systemPrompt: selectedSystemPrompt,
            provider: llmSettings.provider,
            model: (llmSettings.models?.[llmSettings.provider] || '')
        };
        setChatHistory(prev => [...prev, newChat]);
        setActiveChatId(newId);
        return newId;
    }, [selectedSystemPrompt, llmSettings]);

    const sendMessage = useCallback(async () => {
        if (!input.trim()) return;
        if (activeChatId && !messagesLoaded) {
            alert('Loading chat messages, please try again in a moment.');
            return;
        }

        retryStateRef.current = null;
        setHasRetry(false);

        // Separate text files from images
        const textAttachments = attachedFiles.filter(f => f.type === 'text');
        const imageAttachments = attachedFiles.filter(f => f.type === 'image');
        const hasAttachments = attachedFiles.length > 0;

        // Build text prompt: text file contents + user input
        const filePrefix = textAttachments.length > 0 ? formatAttachedFiles(textAttachments) : '';
        const fullPrompt = filePrefix ? filePrefix + '\n\n' + input : input;

        // content = what the LLM sees (text files + typed message); images go separately on payload
        // displayContent / files / images = what the UI renders
        const userMessage = { role: 'user', content: fullPrompt };
        if (hasAttachments) {
            userMessage.displayContent = input;
            userMessage.files = attachedFiles.map(f => ({ name: f.name, type: f.type }));
        }
        if (imageAttachments.length > 0) {
            userMessage.images = imageAttachments.map(f => ({ name: f.name, dataUrl: f.dataUrl }));
        }
        const newMessages = [...messages, userMessage];
        receivedUsageRef.current = false;
        lastUserPromptRef.current = fullPrompt;
        lastTurnHistorySnapshotRef.current = messages;
        setMessages(newMessages);
        setInput('');
        setAttachedFiles([]);
        setIsLoading(true);

        let currentChatId = activeChatId;

        try {
            try { inflightControllerRef.current?.abort(); } catch {}
            inflightControllerRef.current = new AbortController();

            // Create new chat in IndexedDB if needed
            if (!currentChatId) {
                const newTitle = input.substring(0, 50);
                currentChatId = await chatDB.createChat(
                    newTitle,
                    selectedSystemPrompt,
                    llmSettings.provider,
                    (llmSettings.models?.[llmSettings.provider] || '')
                );
                // Save user message BEFORE setting activeChatId to avoid race condition
                const dbMeta = hasAttachments ? { displayContent: input, files: userMessage.files, ...(userMessage.images && { images: userMessage.images }) } : undefined;
                await chatDB.addMessage(currentChatId, userMessage.role, userMessage.content, dbMeta);
                setActiveChatId(currentChatId);

                const now = new Date();
                const newChat = { id: currentChatId, title: newTitle, created: now, updated: now, systemPrompt: selectedSystemPrompt, provider: llmSettings.provider, model: (llmSettings.models?.[llmSettings.provider] || '') };
                setChatHistory(prev => [...prev, newChat]);
            } else {
                const dbMeta = hasAttachments ? { displayContent: input, files: userMessage.files, ...(userMessage.images && { images: userMessage.images }) } : undefined;
                await chatDB.addMessage(currentChatId, userMessage.role, userMessage.content, dbMeta);
            }

            const payload = buildPayload(fullPrompt, messages);

            // Attach images to payload for the current turn only (not re-sent in history)
            if (imageAttachments.length > 0) {
                payload.images = imageAttachments.map(f => {
                    // Extract raw base64 from data URL: "data:image/png;base64,iVBOR..." → "iVBOR..."
                    const base64 = f.dataUrl.split(',')[1];
                    return { mimeType: f.mimeType, data: base64 };
                });
            }

            // Add assistant placeholder
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            let aiResponseText = '';

            for await (const event of streamChat(payload, inflightControllerRef.current.signal)) {
                if (event.type === 'chunk') {
                    aiResponseText += event.text;
                    setMessages(prev => {
                        const updated = [...prev];
                        if (updated.length === 0 || updated[updated.length - 1].role !== 'assistant') {
                            updated.push({ role: 'assistant', content: '' });
                        }
                        updated[updated.length - 1] = { ...updated[updated.length - 1], role: 'assistant', content: aiResponseText };
                        return updated;
                    });
                } else if (event.type === 'usage') {
                    receivedUsageRef.current = true;
                    setUsageLast(event);
                    setUsageTotals(prev => ({
                        input: prev.input + event.inputTokens,
                        output: prev.output + event.outputTokens,
                        total: prev.total + event.totalTokens
                    }));
                }
                // 'done' is a no-op; finalization occurs after the loop
            }

            // Estimate tokens if provider didn't report usage
            if (!receivedUsageRef.current) {
                const historyText = (lastTurnHistorySnapshotRef.current || []).map(m => (m && m.content) ? m.content : '').join('\n');
                const inputText = [historyText, lastUserPromptRef.current, selectedSystemPrompt].filter(Boolean).join('\n');
                const inputTokens = estimateTokens(inputText);
                const outputTokens = estimateTokens(aiResponseText);
                const totalTokens = inputTokens + outputTokens;
                const usage = { inputTokens, outputTokens, totalTokens, method: 'estimated' };
                setUsageLast(usage);
                setUsageTotals(prev => ({
                    input: prev.input + inputTokens,
                    output: prev.output + outputTokens,
                    total: prev.total + totalTokens
                }));
            }

            if (!aiResponseText.trim()) {
                console.log('No response received from the API.');
            }

            // Save AI response to IndexedDB
            await chatDB.addMessage(currentChatId, 'assistant', aiResponseText);

            // Update chat title if it's a new chat
            if (aiResponseText.length > 0) {
                const existingChat = chatHistory.find(chat => chat.id === currentChatId);
                const placeholderTitle = input.substring(0, 50);
                if (existingChat && existingChat.title === placeholderTitle) {
                    const newTitle = input.substring(0, 50) + (input.length > 50 ? '...' : '');
                    await chatDB.updateChatTitle(currentChatId, newTitle);
                    setChatHistory(prev => prev.map(chat =>
                        chat.id === currentChatId ? { ...chat, title: newTitle } : chat
                    ));
                }
            }

            retryStateRef.current = null;
            setHasRetry(false);

        } catch (error) {
            if (error?.name === 'AbortError') {
                const cancelText = 'Request cancelled by user';
                setMessages(prev => [...prev, { role: 'assistant', content: cancelText }]);
                if (currentChatId) {
                    try { await chatDB.addMessage(currentChatId, 'assistant', cancelText); } catch (dbError) { console.error('Failed to persist cancellation message:', dbError); }
                }
                return;
            }

            const userErrorMessage = error.message;
            try { console.debug('Client mapped error', { code: error?.code, message: error?.message }); } catch {}
            console.error('API error occurred during chat request:', error);

            retryStateRef.current = { chatId: currentChatId, payload: buildPayload(input, messages) };
            setHasRetry(true);

            const errorMessage = { role: 'assistant', content: userErrorMessage };
            setMessages(prev => [...prev, errorMessage]);

            if (currentChatId) {
                try {
                    await chatDB.addMessage(currentChatId, errorMessage.role, errorMessage.content);
                } catch (dbError) {
                    console.error('Failed to save error message to database:', dbError);
                }
            }
        } finally {
            setIsLoading(false);
            inflightControllerRef.current = null;
        }
    }, [input, activeChatId, messagesLoaded, messages, selectedSystemPrompt, customPrompt, llmSettings, chatHistory, attachedFiles]);

    // ── Return ─────────────────────────────────────────────
    return {
        // State
        messages, input, isLoading, chatHistory, activeChatId,
        messagesLoaded, usageLast, usageTotals, chatLogRef, hasRetry,
        attachedFiles,

        // Setters for cross-cutting handlers in page.js
        setInput, setActiveChatId, setChatHistory,

        // Operations
        sendMessage,
        deleteChat,
        renameChat,
        downloadChat,
        importChat,
        parseMarkdownChat,
        resend,
        stopGeneration,
        clearChat,
        loadChatHistory,
        addFiles,
        removeFile,
    };
}
