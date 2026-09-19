'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import chatDB from '../lib/database';
import LandingPage from './components/LandingPage';
import ChatColumn from './components/ChatColumn';
import ResourceColumn from './components/ResourceColumn';
import CustomPromptEditor from './components/CustomPromptEditor';
import { builtinLabel } from './components/SystemPromptsSection';
import useChat, { resolveTarget } from './hooks/useChat';
import { useCustomPrompts, customPromptKey, isCustomPromptKey } from './hooks/useCustomPrompts';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_ANTHROPIC_EFFORT, PROVIDER_LABELS } from '../lib/constants';

const PROVIDERS = ['google', 'openai', 'anthropic', 'mistral', 'glm'];
const emptyPerProvider = () => Object.fromEntries(PROVIDERS.map(p => [p, '']));

const defaultLlmSettings = () => ({
    provider: 'google',
    models: emptyPerProvider(),
    temperature: 0.7,
    useProviderDefaultTemperature: true,
    useDeveloperKey: true,
    effort: DEFAULT_ANTHROPIC_EFFORT,
    apiKeys: emptyPerProvider()
});

export default function Home() {
    // ── App-level state (resources, settings, UI panels) ───
    const [learningResources, setLearningResources] = useState([]);
    const [selectedResource, setSelectedResource] = useState(null);
    const [resourceContent, setResourceContent] = useState('');
    const [isChatCollapsed, setIsChatCollapsed] = useState(true);
    const [isResourceCollapsed, setIsResourceCollapsed] = useState(false);
    const [systemPrompts, setSystemPrompts] = useState([]);
    const [editorCollapsed, setEditorCollapsed] = useState(true);
    const [editingPromptKey, setEditingPromptKey] = useState(null);
    const [selectedSystemPrompt, setSelectedSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [llmSettings, setLlmSettings] = useState(defaultLlmSettings);
    const [isLoaded, setIsLoaded] = useState(false);

    // ── Custom prompts (IndexedDB) ─────────────────────────
    const prompts = useCustomPrompts();
    const customPromptList = useMemo(
        () => prompts.customPrompts.map(p => ({ ...p, key: customPromptKey(p.id) })),
        [prompts.customPrompts]
    );
    const selectedCustom = prompts.getPrompt(selectedSystemPrompt);
    const customPromptText = selectedCustom?.content || '';

    // ── Chat hook ──────────────────────────────────────────
    const chat = useChat({ selectedSystemPrompt, customPrompt: customPromptText, llmSettings });

    const target = resolveTarget(llmSettings);
    const targetLabel = `${PROVIDER_LABELS[target.provider] || target.provider} · ${target.model || 'default'}`;
    const settingsNeedAttention = !target.devKey && !(llmSettings.apiKeys?.[target.provider] || '').trim();
    const promptLabel = isCustomPromptKey(selectedSystemPrompt)
        ? (selectedCustom?.name || 'Custom prompt')
        : builtinLabel(selectedSystemPrompt);

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

                        const saved = parsedState.llmSettings || {};
                        const defaults = defaultLlmSettings();
                        setLlmSettings({
                            ...defaults,
                            provider: PROVIDERS.includes(saved.provider) ? saved.provider : 'google',
                            models: { ...defaults.models, ...(saved.models || {}) },
                            temperature: typeof saved.temperature === 'number' ? saved.temperature : 0.7,
                            useProviderDefaultTemperature: saved.useProviderDefaultTemperature !== false,
                            useDeveloperKey: saved.useDeveloperKey !== false,
                            effort: saved.effort || DEFAULT_ANTHROPIC_EFFORT,
                            apiKeys: { ...defaults.apiKeys, ...(saved.apiKeys || {}) }
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

    // Legacy single "Custom Prompt" → migrated IndexedDB prompt
    useEffect(() => {
        if (!prompts.loaded || selectedSystemPrompt !== 'Custom Prompt') return;
        handleSelectSystemPrompt(prompts.migratedKey || DEFAULT_SYSTEM_PROMPT);
    }, [prompts.loaded, prompts.migratedKey, selectedSystemPrompt]);

    // Selected custom prompt was deleted (possibly in another tab) → fall back
    useEffect(() => {
        if (prompts.loaded && isCustomPromptKey(selectedSystemPrompt) && !prompts.getPrompt(selectedSystemPrompt)) {
            handleSelectSystemPrompt(DEFAULT_SYSTEM_PROMPT);
        }
    }, [prompts.loaded, prompts.customPrompts, selectedSystemPrompt]);

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
            const builtins = Array.isArray(data) ? data.filter(p => p !== 'Custom Prompt') : [];
            setSystemPrompts(builtins);
            const savedPrompt = localStorage.getItem('selectedSystemPrompt');
            if (savedPrompt && (builtins.includes(savedPrompt) || isCustomPromptKey(savedPrompt) || savedPrompt === 'Custom Prompt')) {
                setSelectedSystemPrompt(savedPrompt);
            } else if (savedPrompt) {
                localStorage.removeItem('selectedSystemPrompt');
                setSelectedSystemPrompt(DEFAULT_SYSTEM_PROMPT);
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

    const handleSelectSystemPrompt = useCallback((promptName) => {
        setSelectedSystemPrompt(promptName);
        localStorage.setItem('selectedSystemPrompt', promptName);
    }, []);

    const handleCustomPromptEdit = (key) => {
        const k = key || (isCustomPromptKey(selectedSystemPrompt) ? selectedSystemPrompt : null);
        if (!k) return;
        if (!editorCollapsed && editingPromptKey === k) {
            setEditorCollapsed(true);
            return;
        }
        setEditingPromptKey(k);
        setEditorCollapsed(false);
    };

    const handleCreateCustomPrompt = async () => {
        const n = prompts.customPrompts.length + 1;
        const key = await prompts.createPrompt(`Custom Prompt ${n}`, '');
        handleSelectSystemPrompt(key);
        setEditingPromptKey(key);
        setEditorCollapsed(false);
    };

    const handleDeleteCustomPrompt = async (key) => {
        const p = prompts.getPrompt(key);
        if (!p) return;
        await prompts.deletePrompt(p.id);
        if (editingPromptKey === key) { setEditingPromptKey(null); setEditorCollapsed(true); }
        if (selectedSystemPrompt === key) handleSelectSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    };

    const editingPrompt = prompts.getPrompt(editingPromptKey);

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
        if (window.confirm('Are you sure you want to reset the page state? This will clear all chats and selections. Your custom prompts are kept.')) {
            try {
                await chatDB.clearAllData();
                chat.clearChat();
                chat.setChatHistory([]);
                setSelectedResource(null);
                setResourceContent('');
                setIsChatCollapsed(true);
                setIsResourceCollapsed(false);
                setEditorCollapsed(true);
                setSelectedSystemPrompt(DEFAULT_SYSTEM_PROMPT);
                setLlmSettings(defaultLlmSettings());
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
    const showEditor = !editorCollapsed && !!editingPrompt;
    const showLanding = isChatCollapsed && (!selectedResource || isResourceCollapsed) && !showEditor;

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
                onCreateCustomPrompt={handleCreateCustomPrompt}
                onDeleteCustomPrompt={handleDeleteCustomPrompt}
                customPrompts={customPromptList}
                systemPrompts={systemPrompts}
                selectedSystemPrompt={selectedSystemPrompt}
                onSelectSystemPrompt={handleSelectSystemPrompt}
                onResetPageState={handleResetPageState}
                llmSettings={llmSettings}
                onUpdateLlmSettings={handleUpdateLlmSettings}
                settingsNeedAttention={settingsNeedAttention}
            />
            <main id="main-content">
                {showLanding ? (
                    <LandingPage
                        promptLabel={promptLabel}
                        targetLabel={targetLabel}
                        learningResources={learningResources}
                        onSelectResource={handleSelectResource}
                        onNewChat={handleNewChat}
                        onStartChat={(text) => {
                            chat.setInput(text);
                            setIsChatCollapsed(false);
                        }}
                    />
                ) : (
                    <>
                        {!isChatCollapsed && (
                            <ChatColumn chat={chat} targetLabel={targetLabel} onCollapse={() => setIsChatCollapsed(true)} />
                        )}
                        {selectedResource && !isResourceCollapsed && (
                            <ResourceColumn
                                selectedResource={selectedResource}
                                resourceContent={resourceContent}
                                onCollapse={() => setIsResourceCollapsed(true)}
                            />
                        )}
                        {showEditor && (
                            <CustomPromptEditor
                                prompt={editingPrompt}
                                onChange={(changes) => prompts.updatePrompt(editingPrompt.id, changes)}
                                onDelete={() => handleDeleteCustomPrompt(editingPromptKey)}
                                onCollapse={() => setEditorCollapsed(true)}
                            />
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
