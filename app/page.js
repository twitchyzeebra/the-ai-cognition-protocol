'use client';

import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import chatDB from '../lib/database';
import LandingPage from './components/LandingPage';
import ChatColumn from './components/ChatColumn';
import ResourceColumn from './components/ResourceColumn';
import CustomPromptEditor from './components/CustomPromptEditor';
import useChat from './hooks/useChat';

export default function Home() {
    // ── App-level state (resources, settings, UI panels) ───
    const [learningResources, setLearningResources] = useState([]);
    const [selectedResource, setSelectedResource] = useState(null);
    const [resourceContent, setResourceContent] = useState('');
    const [isChatCollapsed, setIsChatCollapsed] = useState(true);
    const [isResourceCollapsed, setIsResourceCollapsed] = useState(false);
    const [systemPrompts, setSystemPrompts] = useState([]);
    const [customPrompt, setCustomPrompt] = useState('');
    const [customPromptModelCollapsed, setIsCustomPromptModelCollapsed] = useState(true);
    const [selectedSystemPrompt, setSelectedSystemPrompt] = useState('Emergent Flavor System');
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
    const [isLoaded, setIsLoaded] = useState(false);

    // ── Chat hook ──────────────────────────────────────────
    const chat = useChat({ selectedSystemPrompt, customPrompt, llmSettings });

    // ── Initial load ───────────────────────────────────────
    useEffect(() => {
        const loadAppState = async () => {
            try {
                await chatDB.migrateFromLocalStorage();

                const storedPageState = localStorage.getItem('pageState');

                if (storedPageState) {
                    try {
                        const parsedState = JSON.parse(storedPageState);

                        if (parsedState.activeChatId) {
                            chat.setActiveChatId(parsedState.activeChatId);
                        }
                        if (parsedState.selectedResource) setSelectedResource(parsedState.selectedResource);
                        if (parsedState.resourceContent) setResourceContent(parsedState.resourceContent);
                        if (parsedState.isChatCollapsed !== undefined) setIsChatCollapsed(parsedState.isChatCollapsed);
                        if (parsedState.isResourceCollapsed !== undefined) setIsResourceCollapsed(parsedState.isResourceCollapsed);
                        if (parsedState.selectedSystemPrompt) setSelectedSystemPrompt(parsedState.selectedSystemPrompt);

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

                await chat.loadChatHistory();

                // Continue chat from resources page
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

                console.log('Loaded app state from IndexedDB and localStorage');
            } catch (error) {
                console.error('Failed to load app state:', error);
                const storedHistory = localStorage.getItem('chatHistory');
                if (storedHistory) {
                    try {
                        chat.setChatHistory(JSON.parse(storedHistory));
                    } catch (parseError) {
                        console.error('Failed to parse localStorage fallback');
                    }
                }
            } finally {
                setIsLoaded(true);
            }
        };

        loadAppState();
        fetchLearningResources();
        fetchSystemPrompts();
    }, []);

    // ── Persist UI state to localStorage ───────────────────
    useEffect(() => {
        if (!isLoaded) return;
        const delay = chat.isLoading ? 1000 : 500;
        const timeoutId = setTimeout(() => {
            localStorage.setItem('pageState', JSON.stringify({
                activeChatId: chat.activeChatId,
                selectedResource,
                resourceContent,
                isChatCollapsed,
                isResourceCollapsed,
                selectedSystemPrompt,
                llmSettings
            }));
            if (chat.chatHistory.length > 0) {
                localStorage.setItem('chatHistory', JSON.stringify(chat.chatHistory));
            }
        }, delay);
        return () => clearTimeout(timeoutId);
    }, [isLoaded, chat.chatHistory, chat.activeChatId, selectedResource, resourceContent, isChatCollapsed, isResourceCollapsed, selectedSystemPrompt, llmSettings]);

    // Dev-only: suppress UI-breaking overlay on unhelpful unhandled rejections
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return;
        const handler = (event) => {
            try {
                const reason = event?.reason;
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

    // Persist custom prompt
    useEffect(() => {
        if (customPrompt && customPrompt.length > 0) {
            localStorage.setItem('customPrompt', customPrompt);
        }
    }, [customPrompt]);

    // ── Data fetching ──────────────────────────────────────
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
            if (saveCustomPrompt) {
                setCustomPrompt(saveCustomPrompt);
            }
            const savedPrompt = localStorage.getItem('selectedSystemPrompt');
            if (savedPrompt && data.includes(savedPrompt)) {
                setSelectedSystemPrompt(savedPrompt);
            }
            if (savedPrompt && !data.includes(savedPrompt)) {
                localStorage.removeItem('selectedSystemPrompt');
                setSelectedSystemPrompt('Cognitive Tiers With Delivery');
            }
        } catch (error) {
            console.error('Failed to fetch system prompts:', error);
        }
    };

    // ── Cross-cutting handlers ─────────────────────────────
    const handleSelectResource = async (slug) => {
        if (slug === selectedResource) {
            setIsResourceCollapsed(prev => !prev);
        } else {
            try {
                const response = await fetch(`/api/learning-resources/${slug}`);
                const data = await response.json();
                setSelectedResource(slug);
                setResourceContent(data.content);
                setIsResourceCollapsed(false);
            } catch (error) {
                console.error(`Failed to fetch resource ${slug}:`, error);
            }
        }
    };

    const handleCustomPromptEdit = () => {
        setIsCustomPromptModelCollapsed(prev => !prev);
    };

    const handleNewChat = () => {
        chat.clearChat();
        setSelectedResource(null);
        setResourceContent('');
        setIsChatCollapsed(false);

        setTimeout(() => {
            const textareaElement = document.querySelector('#chat-input textarea');
            if (textareaElement) {
                textareaElement.focus();
            }
        }, 50);
    };

    const handleSelectChat = (id) => {
        if (id === chat.activeChatId) {
            setIsChatCollapsed(prev => !prev);
        } else {
            chat.setActiveChatId(id);
            setSelectedResource(null);
            setResourceContent('');
            setIsChatCollapsed(false);
        }
    };

    const handleSelectSystemPrompt = (promptName) => {
        setSelectedSystemPrompt(promptName);
        localStorage.setItem('selectedSystemPrompt', promptName);
    };

    const handleUpdateLlmSettings = (partial) => {
        setLlmSettings(prev => {
            const newSettings = { ...prev, ...partial };
            if (partial.apiKey !== undefined) {
                newSettings.apiKeys = {
                    ...prev.apiKeys,
                    [prev.provider]: partial.apiKey
                };
                delete newSettings.apiKey;
            }
            return newSettings;
        });
    };

    const handleResetPageState = async () => {
        if (window.confirm('Are you sure you want to reset the page state? This will clear all chats and selections.')) {
            try {
                await chatDB.clearAllData();
                chat.clearChat();
                chat.setChatHistory([]);
                setSelectedResource(null);
                setResourceContent('');
                setIsChatCollapsed(true);
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
                localStorage.removeItem('pageState');
                localStorage.removeItem('chatHistory');
                localStorage.removeItem('selectedSystemPrompt');
                alert('Page state has been reset successfully.');
            } catch (error) {
                console.error('Failed to reset page state:', error);
                alert('Failed to reset page state. Please try again.');
            }
        }
    };

    const handleUpload = async (eventOrContent) => {
        let text;
        let fileName = 'Imported Chat';
        let isFileEvent = false;

        if (typeof eventOrContent === 'string') {
            text = eventOrContent;
        } else if (eventOrContent?.target?.files) {
            const file = eventOrContent.target.files[0];
            if (!file) return;
            text = await file.text();
            fileName = file.name.replace(/\.(md|markdown)$/i, '');
            isFileEvent = true;
        } else {
            return;
        }

        try {
            const isMd = text.trim().startsWith('#') || /^#\s+.+/m.test(text);
            if (isMd) {
                const { title, messages: mdMessages } = chat.parseMarkdownChat(text);
                if (!mdMessages || mdMessages.length === 0) {
                    alert('No messages found in the Markdown file.');
                } else {
                    await chat.importChat({ title: title || fileName, messages: mdMessages });
                    setIsChatCollapsed(false);
                    return;
                }
            }
            alert('Invalid chat file. Provide a Markdown file created by this app.');
        } catch (error) {
            console.error('Error importing chat file:', error);
            alert('Failed to import chat file. The file might be corrupted or in the wrong format.');
        } finally {
            if (isFileEvent && eventOrContent?.target) {
                eventOrContent.target.value = null;
            }
        }
    };

    // ── Render ─────────────────────────────────────────────
    return (
        <div id="container">
            <Sidebar
                history={chat.chatHistory}
                onNewChat={handleNewChat}
                onSelectChat={handleSelectChat}
                activeChatId={chat.activeChatId}
                onDownload={chat.downloadChat}
                onUpload={handleUpload}
                learningResources={learningResources}
                onSelectResource={handleSelectResource}
                onDeleteChat={chat.deleteChat}
                onRenameChat={chat.renameChat}
                onCustomPromptEdit={handleCustomPromptEdit}
                systemPrompts={systemPrompts}
                selectedSystemPrompt={selectedSystemPrompt}
                onSelectSystemPrompt={handleSelectSystemPrompt}
                onResetPageState={handleResetPageState}
                llmSettings={llmSettings}
                onUpdateLlmSettings={handleUpdateLlmSettings}
            />
            <main id="main-content">
                {isChatCollapsed && (!selectedResource || isResourceCollapsed) && customPromptModelCollapsed ? (
                    <LandingPage
                        selectedSystemPrompt={selectedSystemPrompt}
                        learningResources={learningResources}
                        onSelectResource={handleSelectResource}
                        onStartChat={(text) => {
                            chat.setInput(text);
                            setIsChatCollapsed(false);
                        }}
                    />
                ) : (
                    <>
                        {!isChatCollapsed && (
                            <ChatColumn chat={chat} onCollapse={() => setIsChatCollapsed(true)} />
                        )}
                        {selectedResource && !isResourceCollapsed && (
                            <ResourceColumn
                                selectedResource={selectedResource}
                                resourceContent={resourceContent}
                                onCollapse={() => setIsResourceCollapsed(true)}
                            />
                        )}
                        {selectedSystemPrompt === 'Custom Prompt' && !customPromptModelCollapsed && (
                            <CustomPromptEditor
                                customPrompt={customPrompt}
                                onCustomPromptChange={setCustomPrompt}
                                onCollapse={() => setIsCustomPromptModelCollapsed(true)}
                            />
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
