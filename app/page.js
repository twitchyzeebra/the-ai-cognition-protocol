'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Sidebar from './components/Sidebar';
import chatDB from '../lib/database';
import ChatLog from './components/ChatLog';
import Link from 'next/link';
import { convertMarkdownToPdf } from './utils/markdownToPdf';

export default function Home() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [learningResources, setLearningResources] = useState([]);
    const [selectedResource, setSelectedResource] = useState(null);
    const [resourceContent, setResourceContent] = useState('');
    const [isChatCollapsed, setIsChatCollapsed] = useState(true); // Chat panel minimized by default
    const [isResourceCollapsed, setIsResourceCollapsed] = useState(false);
    const [systemPrompts, setSystemPrompts] = useState([]);
    const [customPrompt, setCustomPrompt] = useState('');
    const [customPromptModelCollapsed, setIsCustomPromptModelCollapsed] = useState(true);
    const [selectedSystemPrompt, setSelectedSystemPrompt] = useState('Emergent Flavor System'); // Default prompt
    const [llmSettings, setLlmSettings] = useState({ 
        provider: 'google', 
        models: { google: '', openai: '', anthropic: '', mistral: '' },
        temperature: 0.0,
        useProviderDefaultTemperature: true,
        useDeveloperKey: true,
        apiKeys: {
            google: '',
            openai: '',
            anthropic: '',
            mistral: ''
        }
    });
    const chatLogRef = useRef(null);
    const inflightControllerRef = useRef(null);
    const retryStateRef = useRef(null);
    const [messagesLoaded, setMessagesLoaded] = useState(true);
    const [isLoaded, setIsLoaded] = useState(false);
    const [usageLast, setUsageLast] = useState(null);
    const [usageTotals, setUsageTotals] = useState({ input: 0, output: 0, total: 0 });
    const receivedUsageRef = useRef(false);
    const lastUserPromptRef = useRef('');
    const lastTurnHistorySnapshotRef = useRef([]);

    // Load state on initial render
    useEffect(() => {
        const loadAppState = async () => {
            try {
                // First, try to migrate from localStorage if needed
                await chatDB.migrateFromLocalStorage();
                
                // Load UI state from localStorage (non-chat data)
                const storedPageState = localStorage.getItem('pageState');
                let storedActiveChatId = null;
                
                if (storedPageState) {
                    try {
                        const parsedState = JSON.parse(storedPageState);
                        
                        // Restore UI state (excluding chat history and messages)
                        if (parsedState.activeChatId) {
                            storedActiveChatId = parsedState.activeChatId;
                            setActiveChatId(parsedState.activeChatId);
                        }
                        if (parsedState.selectedResource) setSelectedResource(parsedState.selectedResource);
                        if (parsedState.resourceContent) setResourceContent(parsedState.resourceContent);
                        if (parsedState.isChatCollapsed !== undefined) setIsChatCollapsed(parsedState.isChatCollapsed);
                        if (parsedState.isResourceCollapsed !== undefined) setIsResourceCollapsed(parsedState.isResourceCollapsed);
                        if (parsedState.selectedSystemPrompt) setSelectedSystemPrompt(parsedState.selectedSystemPrompt);
                        
                        // Always set llmSettings to ensure proper structure
                        setLlmSettings({
                            provider: parsedState.llmSettings?.provider || 'google',
                            models: parsedState.llmSettings?.models || {
                                google: parsedState.llmSettings?.provider === 'google' ? (parsedState.llmSettings?.model || '') : '',
                                openai: parsedState.llmSettings?.provider === 'openai' ? (parsedState.llmSettings?.model || '') : '',
                                anthropic: parsedState.llmSettings?.provider === 'anthropic' ? (parsedState.llmSettings?.model || '') : '',
                                mistral: parsedState.llmSettings?.provider === 'mistral' ? (parsedState.llmSettings?.model || '') : ''
                            },
                            temperature: typeof parsedState.llmSettings?.temperature === 'number' ? parsedState.llmSettings.temperature : 0.7,
                            useProviderDefaultTemperature: !!parsedState.llmSettings?.useProviderDefaultTemperature,
                            useDeveloperKey: !!parsedState.llmSettings?.useDeveloperKey,
                            apiKeys: parsedState.llmSettings?.apiKeys || {
                                google: '',
                                openai: '',
                                anthropic: '',
                                mistral: ''
                            }
                        });
                    } catch (error) {
                        console.error('Failed to parse stored UI state - using defaults');
                    }
                }
                
                // Load chat history from IndexedDB
                const chats = await chatDB.getAllChats();
                setChatHistory(chats);

                // Check if continuing a chat from resources page
                const continueSlug = sessionStorage.getItem('continueChat');
                if (continueSlug) {
                    sessionStorage.removeItem('continueChat');
                    try {
                        const response = await fetch(`/api/learning-resources/${encodeURIComponent(continueSlug)}`);
                        const data = await response.json();
                        await handleUpload(data.content);
                    } catch (error) {
                        console.error('Failed to load resource for chat:', error);
                        alert('Failed to load resource for chat continuation.');
                    }
                }

                // Note: Messages will be loaded automatically by the activeChatId useEffect
                // when storedActiveChatId is set above

                console.log('Loaded app state from IndexedDB and localStorage');
            } catch (error) {
                console.error('Failed to load app state:', error);
                // Fallback to localStorage for backward compatibility
                const storedHistory = localStorage.getItem('chatHistory');
                if (storedHistory) {
                    try {
                        setChatHistory(JSON.parse(storedHistory));
                    } catch (parseError) {
                        console.error('Failed to parse localStorage fallback');
                    }
                }
            } finally {
                // Always allow subsequent saves even if load partially failed
                setIsLoaded(true);
            }
        };
        
        loadAppState();
        fetchLearningResources();
        fetchSystemPrompts();
    }, []);


    // Save UI state to localStorage (excluding chat data which goes to IndexedDB)
    useEffect(() => {
        if (!isLoaded) return; // Don't save until the initial load is complete
        // Adaptive debounce: longer delay while streaming to avoid excessive writes
        const delay = isLoading ? 1000 : 500;
        const timeoutId = setTimeout(() => {
            localStorage.setItem('pageState', JSON.stringify({
                activeChatId,
                selectedResource,
                resourceContent,
                isChatCollapsed,
                isResourceCollapsed,
                selectedSystemPrompt,
                llmSettings
            }));
            if (chatHistory.length > 0) {
                localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
            }
    }, delay);
        return () => clearTimeout(timeoutId);
    }, [isLoaded, chatHistory, activeChatId, selectedResource, resourceContent, isChatCollapsed, isResourceCollapsed, selectedSystemPrompt, llmSettings]);

    // This effect is the single source of truth for loading chat messages.
    // It runs whenever the active chat ID changes.
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

    // Load per-chat usage totals from localStorage when active chat changes
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
        } catch (error){
            console.warn('Failed to load usage totals:', error);
        }
    }, [activeChatId]);

    // Persist usage totals per chat to localStorage
    useEffect(() => {
        if (!activeChatId) return;
        try {
            localStorage.setItem(`usageTotals:${activeChatId}`, JSON.stringify(usageTotals));
        } catch (error){
            console.warn('Failed to save usage totals:', error);
        }
    }, [activeChatId, usageTotals]);

    // Auto-scroll chat log to bottom on new message, but only if user is already at the bottom
    useEffect(() => {
        const chatLog = chatLogRef.current;
        if (!chatLog) return;

        // A flag to check if the user was at the bottom before the new message was added.
        // A 30px threshold is added for flexibility.
        const wasAtBottom = chatLog.scrollHeight - chatLog.clientHeight <= chatLog.scrollTop + 30;

        if (wasAtBottom) {
            // Use requestAnimationFrame to ensure the scroll happens after the DOM has been updated.
            requestAnimationFrame(() => {
                chatLog.scrollTop = chatLog.scrollHeight;
            });
        }
    }, [messages]);

    // Abort any in-flight streaming fetch on unmount to prevent stray rejections
    useEffect(() => {
        return () => {
            try { inflightControllerRef.current?.abort(); } catch {}
        };
    }, []);

    // Dev-only: prevent UI-breaking overlay on unhelpful unhandled rejections (e.g., [object Event])
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return;
        const handler = (event) => {
            try {
                const reason = event?.reason;
                // Suppress overlay for non-Error rejections that provide no useful stack (e.g., Event objects)
                if (reason instanceof Event || (reason && typeof reason === 'object' && reason.type && !reason.stack)) {
                    console.warn('Suppressed unhandled rejection:', reason);
                    event.preventDefault();
                }
            } catch (e) {
                // no-op
            }
        };
        window.addEventListener('unhandledrejection', handler);
        return () => window.removeEventListener('unhandledrejection', handler);
    }, []);
    useEffect(() => {
        if (customPrompt && customPrompt.length > 0) {
            localStorage.setItem('customPrompt', customPrompt);
        }
    }, [customPrompt]);
    const fetchLearningResources = async () => {
        try {
            const response = await fetch('/api/learning-resources');
            const data = await response.json();
            setLearningResources(data);
        } catch (error) {
            console.error('Failed to fetch learning resources:', error);
        }
    };

    const fetchSystemPrompts = async () => {
        try {
            const response = await fetch('/api/system-prompts');
            const data = await response.json();
            setSystemPrompts(data);
            const saveCustomPrompt = localStorage.getItem('customPrompt');
            if (saveCustomPrompt){
                setCustomPrompt(saveCustomPrompt);
            }
            // Load previously selected prompt from localStorage or use default
            const savedPrompt = localStorage.getItem('selectedSystemPrompt');
            if (savedPrompt && data.includes(savedPrompt)) {
                setSelectedSystemPrompt(savedPrompt);
            }
            if (savedPrompt && !data.includes(savedPrompt)){
                localStorage.removeItem('selectedSystemPrompt');
                setSelectedSystemPrompt('Cognitive Tiers With Delivery');
            }
        } catch (error) {
            console.error('Failed to fetch system prompts:', error);
        }
    };

    const handleSelectResource = async (slug) => {
        if (slug === selectedResource) {
            // If the currently selected resource is clicked again, toggle collapse state.
            setIsResourceCollapsed(prev => !prev);
        } else {
            try {
                const response = await fetch(`/api/learning-resources/${slug}`);
                const data = await response.json();
                setSelectedResource(slug);
                setResourceContent(data.content);
                setIsResourceCollapsed(false); // Ensure resource is visible
            } catch (error) {
                console.error(`Failed to fetch resource ${slug}:`, error);
            }
        }
    };

    const handleCustomPromptEdit = () =>{
        setIsCustomPromptModelCollapsed(prev => !prev);
    }

    const handleNewChat = () => {
        // Clear the current state
        setActiveChatId(null);
        setMessages([]);
        setSelectedResource(null);
        setResourceContent('');
        setInput(''); // Clear the input field
        setIsChatCollapsed(false); // Ensure the chat panel is visible
        
        // Create a small delay to ensure the DOM is updated
        setTimeout(() => {
            // Find the textarea and focus it
            const textareaElement = document.querySelector('#chat-input textarea');
            if (textareaElement) {
                textareaElement.focus();
            }
        }, 50);
    };

    const handleSelectChat = (id) => {
        if (id === activeChatId) {
            // If the currently active chat is clicked again, toggle collapse state.
            setIsChatCollapsed(prev => !prev);
        } else {
            // Otherwise, select the new chat and make sure it's visible.
            setActiveChatId(id);
            setSelectedResource(null); // Deselect any resource
            setResourceContent('');
            setIsChatCollapsed(false); // Ensure chat is visible
        }
    };

    const handleDeleteChat = async (id) => {
        try {
            // Delete from IndexedDB
            await chatDB.deleteChat(id);
            
            // Update React state
            setChatHistory(prev => prev.filter(chat => chat.id !== id));
            
            if (activeChatId === id) {
                setActiveChatId(null);
                setMessages([]);
            }
        } catch (error) {
            console.error('Failed to delete chat:', error);
        }
    };

    const handleRenameChat = async (id, newTitle) => {
        try {
            // Update title in IndexedDB
            await chatDB.updateChatTitle(id, newTitle);
            
            // Update React state
            setChatHistory(prev => prev.map(chat =>
                chat.id === id ? { ...chat, title: newTitle } : chat
            ));
        } catch (error) {
            console.error('Failed to rename chat:', error);
        }
    };
    
    const handleSelectSystemPrompt = (promptName) => {
        setSelectedSystemPrompt(promptName);
        localStorage.setItem('selectedSystemPrompt', promptName);
    };
    
    const handleResetPageState = async () => {
        // Confirm with the user before resetting
        if (window.confirm('Are you sure you want to reset the page state? This will clear all chats and selections.')) {
            try {
                // Clear IndexedDB
                await chatDB.clearAllData();
                
                // Clear all state
                setMessages([]);
                setInput('');
                setChatHistory([]);
                setActiveChatId(null);
                setSelectedResource(null);
                setResourceContent('');
                setIsChatCollapsed(true); // Chat panel minimized after reset
                setIsResourceCollapsed(false);
                setSelectedSystemPrompt('Cognitive Tiers With Delivery');
                setLlmSettings({ 
                    provider: 'google', 
                    model: '', 
                    apiKeys: {
                        google: '',
                        openai: '',
                        anthropic: '',
                        mistral: ''
                    }
                });
                
                // Clear localStorage
                localStorage.removeItem('pageState');
                localStorage.removeItem('chatHistory');
                localStorage.removeItem('selectedSystemPrompt');
            
            // Notify the user
            alert('Page state has been reset successfully.');
            } catch (error) {
                console.error('Failed to reset page state:', error);
                alert('Failed to reset page state. Please try again.');
            }
        }
    };

    const handleUpdateLlmSettings = (partial) => {
        setLlmSettings(prev => {
            const newSettings = { ...prev, ...partial };
            if (partial.apiKey !== undefined) {
                newSettings.apiKeys = {
                    ...prev.apiKeys,
                    [prev.provider]: partial.apiKey
                };
                // apiKey is a signal to update a specific provider's key, not a top-level field
                delete newSettings.apiKey;
            }
            return newSettings;
        });
    };

    const handleDownload = async (format = 'json') => {
        if (format === 'md' || format === 'pdf') {
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
            // Only include title for MD export, not PDF
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
                // Convert markdown to PDF
                await convertMarkdownToPdf(md, `${activeChat.title}.pdf`);
            } else {
                // Download as markdown
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
            return;
        }
    };

    // Helper to parse Markdown chat exports generated by this app
    function parseMarkdownChat(mdText) {
        const text = (mdText || '').replace(/\r\n/g, '\n');
        const lines = text.split('\n');
        let idx = 0;
        let title = 'Imported Chat';
        if (lines[0] && lines[0].startsWith('# ')) {
            title = lines[0].slice(2).trim() || title;
            idx = 1;
        }
        const messages = [];
        let currentRole = null;
        let buffer = [];
        const flush = () => {
            if (currentRole) {
                const content = buffer.join('\n').trim();
                if (content) messages.push({ role: currentRole, content });
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
        return { title, messages };
    }

    const handleUpload = async (eventOrContent) => {
        let text;
        let fileName = 'Imported Chat';
        let isFileEvent = false;

        // Determine if this is a file event or direct content
        if (typeof eventOrContent === 'string') {
            // Direct markdown content string
            text = eventOrContent;
        } else if (eventOrContent?.target?.files) {
            // Traditional file input event
            const file = eventOrContent.target.files[0];
            if (!file) return;
            text = await file.text();
            fileName = file.name.replace(/\.(md|markdown)$/i, '');
            isFileEvent = true;
        } else {
            return; // Invalid input
        }

        try {
            const isMd = text.trim().startsWith('#') || /^#\s+.+/m.test(text);
            if (isMd) {
                const { title, messages: mdMessages } = parseMarkdownChat(text);
                if (!mdMessages || mdMessages.length === 0) {
                    alert('No messages found in the Markdown file.');
                } else {
                    const newTitle = title || fileName;
                    const newId = await chatDB.createChat(
                        newTitle,
                        selectedSystemPrompt,
                        llmSettings.provider,
                        (llmSettings.models?.[llmSettings.provider] || '')
                    );
                    for (const m of mdMessages) {
                        await chatDB.addMessage(newId, m.role === 'assistant' ? 'assistant' : 'user', m.content);
                    }
                    const now = new Date();
                    const newChat = {
                        id: newId,
                        title: newTitle,
                        created: now,
                        updated: now,
                        systemPrompt: selectedSystemPrompt,
                        provider: llmSettings.provider,
                        model: (llmSettings.models?.[llmSettings.provider] || '')
                    };
                    setChatHistory(prev => [...prev, newChat]);
                    setActiveChatId(newId);
                    setIsChatCollapsed(false);
                    return;
                }
            }

            alert('Invalid chat file. Provide a Markdown file created by this app.');
        } catch (error) {
            console.error('Error importing chat file:', error);
            alert('Failed to import chat file. The file might be corrupted or in the wrong format.');
        } finally {
            // Reset file input only if this was a file event
            if (isFileEvent && eventOrContent?.target) {
                eventOrContent.target.value = null;
            }
        }
    };

// Build request payload consistently
    const buildPayload = (promptText, priorMessages) => {
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
        if(selectedSystemPrompt === 'Custom Prompt'){
            payload.customPrompt = customPrompt;
        }
        if(!!llmSettings.useDeveloperKey){
            payload.provider = 'anthropic';
            payload.model = 'claude-opus-4-6';
            payload.useDeveloperKey = true;
        }
        return payload; 
    };

    const resend = () =>  {
        setInput(lastUserPromptRef.current || '');
    }

    const handleSendMessage = async () => {
        if (!input.trim()) return;
        if (activeChatId && !messagesLoaded) {
            alert('Loading chat messages, please try again in a moment.');
            return;
        }

        // Clear any previous retry state when starting a new message
        retryStateRef.current = null;

        const userMessage = { role: 'user', content: input };
        const newMessages = [...messages, userMessage];
        // Initialize usage tracking for this turn
        receivedUsageRef.current = false;
        lastUserPromptRef.current = input;
        lastTurnHistorySnapshotRef.current = messages;
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        let currentChatId = activeChatId;

        try {
            // Abort any prior inflight request before starting a new one
            try { inflightControllerRef.current?.abort(); } catch {}
            inflightControllerRef.current = new AbortController();
            
            // If no active chat, create a new one in IndexedDB
            if (!currentChatId) {
                const newTitle = input.substring(0, 50);
                currentChatId = await chatDB.createChat(
                    newTitle,
                    selectedSystemPrompt,
                    llmSettings.provider,
                    (llmSettings.models?.[llmSettings.provider] || '')
                );
                
                // Save user message to IndexedDB BEFORE setting active chat ID
                // This prevents race condition with the activeChatId useEffect
                await chatDB.addMessage(currentChatId, userMessage.role, userMessage.content);
                
                // Now it's safe to set the active chat ID, which will trigger useEffect to load messages
                setActiveChatId(currentChatId);
                
                // Update chat history in React state
                const now = new Date();
                const newChat = { id: currentChatId, title: newTitle, created: now, updated: now, systemPrompt: selectedSystemPrompt, provider: llmSettings.provider, model: (llmSettings.models?.[llmSettings.provider] || '') };
                setChatHistory(prev => [...prev, newChat]);
            } else {
                // For existing chats, save user message to IndexedDB
                await chatDB.addMessage(currentChatId, userMessage.role, userMessage.content);
            }
            
            // Build payload and optionally omit temperature to use provider defaults
            const payload = buildPayload(input, messages);

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: inflightControllerRef.current.signal,
            });

            // Check for HTTP errors before processing response
            if (!response.ok) {
                let errorMessage = `API request failed with status ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (e) {
                    // If we can't parse JSON, use the status text
                    errorMessage = `API request failed: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            if (!response.body) {
                throw new Error("Response body is null");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponseText = '';

            // Add a placeholder for the AI response
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            // Robust SSE parsing with a rolling buffer to handle chunk-splitting
            let buffer = '';
            const applyEvent = (eventText) => {
                // Normalize CRLF and accumulate any 'data:' lines per SSE spec
                const lines = eventText.replace(/\r/g, '').split('\n');
                const dataLines = [];
                for (const raw of lines) {
                    if (raw.startsWith('data:')) {
                        dataLines.push(raw.slice(5).trimStart());
                    }
                }
                if (dataLines.length === 0) return;
                const payload = dataLines.join('\n');
                let json;
                try {
                    json = JSON.parse(payload);
                } catch {
                    // Not valid JSON; ignore this event
                    return;
                }
                if (json.type === 'chunk' && typeof json.text === 'string') {
                    aiResponseText += json.text;
                    setMessages(prev => {
                        const updated = [...prev];
                        // Ensure there's an assistant placeholder at the end; avoid overwriting a user message
                        if (updated.length === 0 || updated[updated.length - 1].role !== 'assistant') {
                            updated.push({ role: 'assistant', content: '' });
                        }
                        // Update the assistant message content safely
                        updated[updated.length - 1] = { ...updated[updated.length - 1], role: 'assistant', content: aiResponseText };
                        return updated;
                    });
                } else if (json.type === 'usage') {
                    // Provider-reported token usage
                    const u = {
                        inputTokens: Number(json.inputTokens || 0),
                        outputTokens: Number(json.outputTokens || 0),
                        totalTokens: Number(json.totalTokens || 0),
                    };
                    receivedUsageRef.current = true;
                    setUsageLast(u);
                    setUsageTotals(prev => ({
                        input: prev.input + u.inputTokens,
                        output: prev.output + u.outputTokens,
                        total: prev.total + u.totalTokens
                    }));
                } else if (json.type === 'error') {
                    throw new Error(json.message || 'Unknown error');
                } else if (json.type === 'done') {
                    // no-op; finalization will occur after stream ends
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // Process any residual buffered event (no trailing blank line)
                    if (buffer.trim().length > 0) {
                        applyEvent(buffer);
                    }
                    break;
                }
                buffer += decoder.decode(value, { stream: true });

                // Extract complete SSE events separated by blank lines
                let sepIndex;
                while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
                    const eventBlock = buffer.slice(0, sepIndex);
                    buffer = buffer.slice(sepIndex + 2);
                    applyEvent(eventBlock);
                }
            }
            
            // If provider did not report usage, estimate tokens for this turn
            if (!receivedUsageRef.current) {
                const estimateTokens = (s) => {
                    try {
                        const len = (s || '').length;
                        return len ? Math.max(1, Math.ceil(len / 4)) : 0;
                    } catch { return 0; }
                };
                const historyText = (lastTurnHistorySnapshotRef.current || []).map(m => (m && m.content) ? m.content : '').join('\n');
                const inputText = [historyText, lastUserPromptRef.current, selectedSystemPrompt].filter(Boolean).join('\n');
                const inputTokens = estimateTokens(inputText);
                const outputTokens = estimateTokens(aiResponseText);
                const totalTokens = inputTokens + outputTokens;
                const usage = {
                    inputTokens, outputTokens, totalTokens, method: 'estimated'
                };
                setUsageLast(usage);
                setUsageTotals(prev => ({
                    input: prev.input + inputTokens,
                    output: prev.output + outputTokens,
                    total: prev.total + totalTokens
                }));
            }

            // Check if we got any response content
            if (!aiResponseText.trim()) {
                console.log("No response received from the API. This might be due to an invalid API key, model, or service issue.");
            }
            
            // Save the complete AI response to IndexedDB
            const aiMessage = { role: 'assistant', content: aiResponseText };
            await chatDB.addMessage(currentChatId, aiMessage.role, aiMessage.content);
            
            // Update chat title if it's a new chat and we have a meaningful response
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
            
            // Clear retry state on successful completion
            retryStateRef.current = null;
            // No-op: community prompt support removed.

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
            try { console.debug("Client mapped error", { code: error && error.code, message: error && error.message }); } catch {}
            
            console.error("API error occurred during chat request:", error);
            
            // Save request for retry on failure
            const retryPayload = buildPayload(input, messages);
            retryStateRef.current = { chatId: currentChatId, payload: retryPayload };
            
            // Add error message to chat
            const errorMessage = { role: 'assistant', content: userErrorMessage };
            setMessages(prev => [...prev, errorMessage]);
            
            // Save error message to IndexedDB if we have a chat
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
    };

    return (
        <div id="container">
            <Sidebar 
                history={chatHistory} 
                onNewChat={handleNewChat} 
                onSelectChat={handleSelectChat}
                activeChatId={activeChatId}
                onDownload={handleDownload}
                onUpload={handleUpload}
                learningResources={learningResources}
                onSelectResource={handleSelectResource}
                onDeleteChat={handleDeleteChat}
                onRenameChat={handleRenameChat}
                onCustomPromptEdit={handleCustomPromptEdit}
                systemPrompts={systemPrompts}
                selectedSystemPrompt={selectedSystemPrompt}
                onSelectSystemPrompt={handleSelectSystemPrompt}
                onResetPageState={handleResetPageState}
                llmSettings={llmSettings}
                onUpdateLlmSettings={handleUpdateLlmSettings}
            />
            <main id="main-content">
                {/* Show landing page when both chat and resources are collapsed */}
                {isChatCollapsed && (!selectedResource || isResourceCollapsed) && customPromptModelCollapsed ? (
                    <div className="landing-page-centered">
                        <h1>Welcome to The AI Cognition Protocol</h1>
                        <div className="landing-intro">
                            <p><strong>A Framework for Your Mind. A Commitment to Your Safety.</strong></p>
                            <p>This is a space for curiosity and growth. To ensure your journey is empowering, we operate on a few core beliefs.</p>
                            <ul>
                                <li><strong>Growth over Grades.</strong> This is a practice, not a performance.</li>
                                <li><strong>You're in Control.</strong> Our tools are suggestions, not rules. You are the expert.</li>
                                <li><strong>Clarity is Kindness.</strong> We're transparent about our methods and the fact that self-reflection can be challenging.</li>
                            </ul>
                            <p><em><strong>Please Note:</strong> These tools are for educational and self-development purposes. They are not a substitute for professional therapy or medical advice. Please seek help from a qualified professional if you are in distress.</em></p>
                        </div>
                        <p>Currently using: <strong>{selectedSystemPrompt.replace(/-/g, ' ')}</strong></p>
                        
                        <div className="panel-controls">
                            <button
                                onClick={() => {
                                    const lower = (s) => (s || '').toLowerCase();
                                    const res = learningResources.find(r => lower(r.slug).includes('website guide') || lower(r.title).includes('website guide'));
                                    if (res && res.slug) {
                                        handleSelectResource(res.slug);
                                    } else {
                                        handleSelectResource('Website Guide');
                                    }
                                }}
                                className="panel-toggle-btn"
                            >
                                Show Website Guide
                            </button>
                            <button 
                                onClick={() => {
                                    setInput("Tell me about yourself and how to use you.");
                                    setIsChatCollapsed(false); // Show the chat
                                }}
                                className="landing-option-btn"
                            >
                                Start talking with the AI
                            </button>
                            <Link href="/resources">
                                <button className="landing-option-btn">
                                    📚 View Learning Resources
                                </button>
                            </Link>
                            
                        </div>

                        <div className="landing-options">
                            <a 
                                href="https://ko-fi.com/cognitivearchitect"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="landing-option-btn"
                                title="Support this project on Ko-fi"
                            >
                                ☕ Support this project on Ko-fi
                            </a>
                        </div>
                    </div>
                ) : (
                    <>
                        {!isChatCollapsed && (
                            <div id="chat-column">
                                <div className="column-header">
                                    <h2>Chat</h2>
                                    <div className="header-actions">
                                        {(usageLast || usageTotals.total > 0) && (
                                            <div
                                                className="header-usage"
                                                title={`${usageLast ? `Last: ${usageLast.inputTokens} in + ${usageLast.outputTokens} out = ${usageLast.totalTokens} tokens` : ''}${usageLast ? ' | ' : ''}Session: ${usageTotals.input} in + ${usageTotals.output} out = ${usageTotals.total} tokens`}
                                            >
                                                {usageLast && (
                                                    <div className="usage-line last">
                                                        Last: {usageLast.inputTokens} in + {usageLast.outputTokens} out = {usageLast.totalTokens} tokens
                                                    </div>
                                                )}
                                                <div className="usage-line session">Session: {usageTotals.input} in + {usageTotals.output} out = {usageTotals.total} tokens</div>
                                            </div>
                                        )}
                                        <button 
                                            className="collapse-btn" 
                                            onClick={() => setIsChatCollapsed(true)} 
                                            title="Collapse chat"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                                <ChatLog messages={messages} isLoading={isLoading} chatLogRef={chatLogRef} />
                                <div id="chat-input">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder="Type your message..."
                                        disabled={isLoading}
                                    />
                                    <button onClick={handleSendMessage} disabled={isLoading || (activeChatId && !messagesLoaded)}>
                                        {isLoading ? 'Thinking...' : 'Send'}
                                    </button>
                                    {isLoading && (
                                        <button onClick={() => { try { inflightControllerRef.current?.abort(); } catch {} }}>
                                            Stop
                                        </button>
                                    )}
                                    {!isLoading && retryStateRef.current !== null && input === '' &&(
                                        <button onClick={resend}> 
                                            Copy Last
                                        </button>
                        )}
                                </div>
                            </div>
                        )}
                        
                        {selectedResource && !isResourceCollapsed && (
                            <div id="resource-column">
                                <div className="column-header">
                                    <h2>Resource: {selectedResource.replace(/-/g, ' ')}</h2>
                                    <button 
                                        className="collapse-btn" 
                                        onClick={() => setIsResourceCollapsed(true)} 
                                        title="Collapse resource"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="prose lg:prose-xl p-4">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{resourceContent}</ReactMarkdown>
                                </div>
                            </div>
                        )}
                        {selectedSystemPrompt === 'Custom Prompt' && !customPromptModelCollapsed && (
                            <div id="custom-prompt-column">
                                <div className="column-header">
                                    <h2>Custom System Prompt</h2>
                                    <button 
                                        className="collapse-btn" 
                                        onClick={() => setIsCustomPromptModelCollapsed(true)} 
                                        title="Collapse custom prompt editor"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="custom-prompt-editor">
                                    <p className="editor-description">
                                        Write your own system prompt to define how the AI should behave. This can be used after other system prompts.
                                    </p>
                                    <textarea
                                        className="custom-prompt-textarea"
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="Enter your custom system prompt here...
                                        Example: You are a helpful assistant who explains concepts clearly and concisely."
                                        maxLength={10000}
                                    />
                                    <div className="char-counter">
                                        {customPrompt.length} / 10,000
                                    </div>
                                    <p className="editor-hint">
                                        Changes are saved automatically to your browser's local storage.
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
