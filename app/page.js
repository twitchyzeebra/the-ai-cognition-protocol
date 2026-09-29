'use client';

import { useState, useEffect, useMemo } from 'react';
import chatDB from '../lib/database';
import Sidebar from './components/Sidebar';
import LandingPage from './components/LandingPage';
import ChatColumn from './components/ChatColumn';
import ResourceColumn from './components/ResourceColumn';
import CustomPromptEditor from './components/CustomPromptEditor';
import { builtinLabel } from './components/SystemPromptsSection';
import useChat, { resolveTarget } from './hooks/useChat';
import { useCustomPrompts } from './hooks/useCustomPrompts';
import { fetchJson, resourceUrl } from './utils/helpers';
import {
    DEFAULT_SYSTEM_PROMPT, DEFAULT_EFFORT, EFFORT_LEVELS, PROVIDERS, LEGACY_CUSTOM_PROMPT,
    customPromptKey, isCustomPromptKey, providerLabel
} from '../lib/constants';

const perProvider = () => Object.fromEntries(PROVIDERS.map(p => [p, '']));
const defaultLlmSettings = () => ({
    provider: 'google',
    models: perProvider(),
    temperature: 0.7,
    useProviderDefaultTemperature: true,
    useDeveloperKey: true,
    efforts: { ...DEFAULT_EFFORT },
    apiKeys: perProvider()
});

// Saved settings over defaults, dropping invalid values. Older saves stored a single `effort` string (Anthropic only).
function restoreLlmSettings(saved = {}) {
    const settings = defaultLlmSettings();
    const efforts = saved.efforts && typeof saved.efforts === 'object' ? saved.efforts : typeof saved.effort === 'string' ? { anthropic: saved.effort } : {};
    for (const p of Object.keys(EFFORT_LEVELS)) if (EFFORT_LEVELS[p].includes(efforts[p])) settings.efforts[p] = efforts[p];
    return {
        ...settings,
        provider: PROVIDERS.includes(saved.provider) ? saved.provider : settings.provider,
        models: { ...settings.models, ...saved.models },
        temperature: typeof saved.temperature === 'number' ? saved.temperature : settings.temperature,
        useProviderDefaultTemperature: saved.useProviderDefaultTemperature !== false,
        useDeveloperKey: saved.useDeveloperKey !== false,
        apiKeys: { ...settings.apiKeys, ...saved.apiKeys }
    };
}

export default function Home() {
    // ── App-level state (resources, settings, UI panels) ───
    const [learningResources, setLearningResources] = useState([]);
    const [systemPrompts, setSystemPrompts] = useState(null); // built-in names; null until fetched
    const [selectedResource, setSelectedResource] = useState(null);
    const [resourceContent, setResourceContent] = useState('');
    const [isChatCollapsed, setIsChatCollapsed] = useState(true);
    const [isResourceCollapsed, setIsResourceCollapsed] = useState(false);
    const [editingPromptKey, setEditingPromptKey] = useState(null); // custom prompt open in the editor
    const [selectedSystemPrompt, setSelectedSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [llmSettings, setLlmSettings] = useState(defaultLlmSettings);
    const [isLoaded, setIsLoaded] = useState(false);

    const prompts = useCustomPrompts();
    const customPromptList = useMemo(() => prompts.customPrompts.map(p => ({ ...p, key: customPromptKey(p.id) })), [prompts.customPrompts]);
    const selectedCustom = prompts.getPrompt(selectedSystemPrompt);
    const editingPrompt = prompts.getPrompt(editingPromptKey);

    const chat = useChat({ selectedSystemPrompt, customPrompt: selectedCustom?.content || '', llmSettings });

    const target = resolveTarget(llmSettings);
    const targetLabel = `${providerLabel(target.provider)} · ${target.model || 'default'}`;
    const settingsNeedAttention = !target.devKey && !(llmSettings.apiKeys?.[target.provider] || '').trim();
    const promptLabel = isCustomPromptKey(selectedSystemPrompt) ? selectedCustom?.name || 'Custom prompt' : builtinLabel(selectedSystemPrompt);

    // ── Initial load ───────────────────────────────────────
    useEffect(() => {
        fetchJson('/api/learning-resources')
            .then(list => setLearningResources(Array.isArray(list) ? list : []))
            .catch(error => console.error('Failed to fetch learning resources:', error));
        fetchJson('/api/system-prompts')
            .then(list => setSystemPrompts(Array.isArray(list) ? list.filter(p => p !== LEGACY_CUSTOM_PROMPT) : []))
            .catch(error => console.error('Failed to fetch system prompts:', error));

        (async () => {
            try {
                await chatDB.migrateFromLocalStorage();
                let saved = {};
                try { saved = JSON.parse(localStorage.getItem('pageState')) || {}; } catch { console.error('Failed to parse stored UI state - using defaults'); }
                if (typeof saved.isChatCollapsed === 'boolean') setIsChatCollapsed(saved.isChatCollapsed);
                if (typeof saved.isResourceCollapsed === 'boolean') setIsResourceCollapsed(saved.isResourceCollapsed);
                // Older versions also kept the selection under its own key.
                const savedPrompt = saved.selectedSystemPrompt || localStorage.getItem('selectedSystemPrompt');
                localStorage.removeItem('selectedSystemPrompt');
                if (savedPrompt) setSelectedSystemPrompt(savedPrompt);
                setLlmSettings(restoreLlmSettings(saved.llmSettings));
                if (saved.selectedResource) {
                    fetchJson(resourceUrl(saved.selectedResource))
                        .then(({ content }) => { setSelectedResource(saved.selectedResource); setResourceContent(content); })
                        .catch(error => console.warn('Saved resource is no longer available:', error));
                }

                const chats = await chat.loadChatHistory();
                if (chats.some(c => c.id === saved.activeChatId)) chat.setActiveChatId(saved.activeChatId);

                // "Continue Chat" from the resources page
                const continueSlug = sessionStorage.getItem('continueChat');
                if (continueSlug) {
                    sessionStorage.removeItem('continueChat');
                    try {
                        await handleUpload((await fetchJson(resourceUrl(continueSlug))).content);
                    } catch (error) {
                        console.error('Failed to load resource for chat:', error);
                        alert('Failed to load resource for chat continuation.');
                    }
                }
            } catch (error) {
                console.error('Failed to load app state:', error);
            } finally {
                setIsLoaded(true);
            }
        })();
    }, []);

    // Keep the selected prompt valid: migrate the legacy 'Custom Prompt', drop deleted custom prompts and removed built-ins.
    useEffect(() => {
        if (!isLoaded || !prompts.loaded) return;
        if (selectedSystemPrompt === LEGACY_CUSTOM_PROMPT) {
            const first = prompts.customPrompts[0];
            setSelectedSystemPrompt(prompts.migratedKey || (first ? customPromptKey(first.id) : DEFAULT_SYSTEM_PROMPT));
        } else if (isCustomPromptKey(selectedSystemPrompt) ? !selectedCustom : systemPrompts?.length && !systemPrompts.includes(selectedSystemPrompt)) {
            setSelectedSystemPrompt(DEFAULT_SYSTEM_PROMPT);
        }
    }, [isLoaded, prompts.loaded, prompts.customPrompts, prompts.migratedKey, systemPrompts, selectedSystemPrompt, selectedCustom]);

    // ── Persist UI state (debounced) ───────────────────────
    useEffect(() => {
        if (!isLoaded) return;
        const timer = setTimeout(() => {
            try {
                localStorage.setItem('pageState', JSON.stringify({
                    activeChatId: chat.activeChatId, selectedResource, isChatCollapsed, isResourceCollapsed, selectedSystemPrompt, llmSettings
                }));
            } catch (error) {
                console.warn('Failed to save UI state:', error);
            }
        }, chat.isLoading ? 1000 : 500);
        return () => clearTimeout(timer);
    }, [isLoaded, chat.activeChatId, chat.isLoading, selectedResource, isChatCollapsed, isResourceCollapsed, selectedSystemPrompt, llmSettings]);

    // Dev-only: keep the error overlay from blocking the UI on unhelpful Event-type rejections.
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return;
        const handler = (event) => {
            const reason = event?.reason;
            if (reason instanceof Event || (reason && typeof reason === 'object' && reason.type && !reason.stack)) {
                console.warn('Suppressed unhandled rejection:', reason);
                event.preventDefault();
            }
        };
        window.addEventListener('unhandledrejection', handler);
        return () => window.removeEventListener('unhandledrejection', handler);
    }, []);

    // ── Handlers ───────────────────────────────────────────
    const handleSelectResource = async (slug) => {
        if (slug === selectedResource) return setIsResourceCollapsed(c => !c);
        try {
            const { content } = await fetchJson(resourceUrl(slug));
            setSelectedResource(slug);
            setResourceContent(content);
            setIsResourceCollapsed(false);
        } catch (error) {
            console.error(`Failed to fetch resource ${slug}:`, error);
        }
    };

    const handleCustomPromptEdit = (key) => setEditingPromptKey(k => (k === key ? null : key));

    const handleCreateCustomPrompt = async () => {
        try {
            const key = await prompts.createPrompt(`Custom Prompt ${prompts.customPrompts.length + 1}`, '');
            setSelectedSystemPrompt(key);
            setEditingPromptKey(key);
        } catch (error) {
            console.error('Failed to create custom prompt:', error);
        }
    };

    const handleDeleteCustomPrompt = async (key) => {
        const prompt = prompts.getPrompt(key);
        if (!prompt) return;
        try {
            await prompts.deletePrompt(prompt.id);
        } catch (error) {
            return console.error('Failed to delete custom prompt:', error);
        }
        if (editingPromptKey === key) setEditingPromptKey(null);
        if (selectedSystemPrompt === key) setSelectedSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    };

    const closeResource = () => { setSelectedResource(null); setResourceContent(''); };

    const handleNewChat = () => {
        chat.clearChat();
        closeResource();
        setIsChatCollapsed(false);
        setTimeout(() => document.querySelector('#chat-input textarea')?.focus(), 50);
    };

    const handleSelectChat = (id) => {
        if (id === chat.activeChatId) return setIsChatCollapsed(c => !c);
        chat.setActiveChatId(id);
        closeResource();
        setIsChatCollapsed(false);
    };

    const handleResetPageState = async () => {
        if (!window.confirm('Are you sure you want to reset the page state? This will clear all chats and selections. Your custom prompts are kept.')) return;
        try {
            await chatDB.clearAllData();
            chat.clearChat();
            chat.setChatHistory([]);
            closeResource();
            setIsChatCollapsed(true);
            setIsResourceCollapsed(false);
            setEditingPromptKey(null);
            setSelectedSystemPrompt(DEFAULT_SYSTEM_PROMPT);
            setLlmSettings(defaultLlmSettings());
            for (const key of Object.keys(localStorage)) {
                if (['pageState', 'chatHistory', 'sidebarState'].includes(key) || key.startsWith('usageTotals:')) localStorage.removeItem(key);
            }
            alert('Page state has been reset successfully.');
        } catch (error) {
            console.error('Failed to reset page state:', error);
            alert('Failed to reset page state. Please try again.');
        }
    };

    // Imports a Markdown chat export (uploaded file or a chattable learning resource).
    const handleUpload = async (text) => {
        try {
            if (!text.trim().startsWith('#') && !/^#\s+.+/m.test(text)) {
                alert('Invalid chat file. Provide a Markdown file created by this app.');
            } else if (!(await chat.importMarkdown(text))) {
                alert('No messages found in the Markdown file.');
            } else {
                setIsChatCollapsed(false);
            }
        } catch (error) {
            console.error('Error importing chat file:', error);
            alert('Failed to import chat file. The file might be corrupted or in the wrong format.');
        }
    };

    const handleUploadFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) await handleUpload(await file.text());
    };

    // ── Render ─────────────────────────────────────────────
    const showLanding = isChatCollapsed && (!selectedResource || isResourceCollapsed) && !editingPrompt;

    return (
        <div id="container">
            <Sidebar
                chat={chat}
                onNewChat={handleNewChat}
                onSelectChat={handleSelectChat}
                onUpload={handleUploadFile}
                learningResources={learningResources}
                onSelectResource={handleSelectResource}
                prompts={{
                    systemPrompts: systemPrompts || [],
                    customPrompts: customPromptList,
                    selectedSystemPrompt,
                    onSelectSystemPrompt: setSelectedSystemPrompt,
                    onCustomPromptEdit: handleCustomPromptEdit,
                    onCreateCustomPrompt: handleCreateCustomPrompt,
                    onDeleteCustomPrompt: handleDeleteCustomPrompt
                }}
                settings={{ llmSettings, onUpdateLlmSettings: (changes) => setLlmSettings(prev => ({ ...prev, ...changes })) }}
                settingsNeedAttention={settingsNeedAttention}
                onResetPageState={handleResetPageState}
            />
            <main id="main-content">
                {showLanding ? (
                    <LandingPage
                        promptLabel={promptLabel}
                        targetLabel={targetLabel}
                        onSelectResource={handleSelectResource}
                        onNewChat={handleNewChat}
                        onStartChat={(text) => { chat.setInput(text); setIsChatCollapsed(false); }}
                    />
                ) : (
                    <>
                        {!isChatCollapsed && <ChatColumn chat={chat} targetLabel={targetLabel} onCollapse={() => setIsChatCollapsed(true)} />}
                        {selectedResource && !isResourceCollapsed && (
                            <ResourceColumn selectedResource={selectedResource} resourceContent={resourceContent} onCollapse={() => setIsResourceCollapsed(true)} />
                        )}
                        {editingPrompt && (
                            <CustomPromptEditor
                                key={editingPrompt.id}
                                prompt={editingPrompt}
                                onChange={(changes) => prompts.updatePrompt(editingPrompt.id, changes)}
                                onDelete={() => handleDeleteCustomPrompt(editingPromptKey)}
                                onCollapse={() => setEditingPromptKey(null)}
                            />
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
