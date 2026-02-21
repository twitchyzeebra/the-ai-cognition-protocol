'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Sidebar({ 
    history, 
    onNewChat, 
    onSelectChat, 
    activeChatId,
    onDownload,
    onExportMarkdown,
    onUpload,
    learningResources,
    onSelectResource,
    onDeleteChat,
    onCustomPromptEdit,
    onRenameChat,
    systemPrompts,
    selectedSystemPrompt,
    onSelectSystemPrompt,
    onResetPageState,
    llmSettings,
    onUpdateLlmSettings
}) {
    // UI state (with localStorage persistence)
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(true);
    const [isResourcesVisible, setIsResourcesVisible] = useState(false);
    const [isPromptsVisible, setIsPromptsVisible] = useState(false);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isSmall, setIsSmall] = useState(false);

    // Enhancements
    const [historyQuery, setHistoryQuery] = useState('');
    const [confirmingDelete, setConfirmingDelete] = useState(null);
    const [renamingChat, setRenamingChat] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [settingsMenuOpen, setSettingsMenuOpen] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const providerModelPresets = {
        google: [
            'gemini-3-flash-preview'
        ],
        openai: [
            'gpt-5.2'
        ],
        anthropic: [
            'claude-sonnet-4-6',
            'claude-opus-4-6',
            'claude-haiku-4-5'
        ],
        mistral: [
            'mistral-large-latest',
            'mistral-medium-latest',
            'mistral-small-latest',
            'magistral-medium-latest',
            'magistral-small-latest',
            'codestral-latest'
        ],
        glm: [
            'GLM-5',
            'GLM-4.7-Flash',
            'GLM-4.7-FlashX',
            'GLM-5-Code'
        ],
    };

    // Load persisted UI state on mount
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('sidebarState') || '{}');
            if (typeof saved.isCollapsed === 'boolean') setIsCollapsed(saved.isCollapsed);
            if (typeof saved.isHistoryVisible === 'boolean') setIsHistoryVisible(saved.isHistoryVisible);
            if (typeof saved.isResourcesVisible === 'boolean') setIsResourcesVisible(saved.isResourcesVisible);
            if (typeof saved.isPromptsVisible === 'boolean') setIsPromptsVisible(saved.isPromptsVisible);
            if (typeof saved.isSettingsVisible === 'boolean') setIsSettingsVisible(saved.isSettingsVisible);
            
            // Default to collapsed on small screens if no saved preference
            if (typeof saved.isCollapsed !== 'boolean') {
                try {
                    if (typeof window !== 'undefined' && window.innerWidth < 900) {
                        setIsCollapsed(true);
                    }
                } catch {}
            }
        } catch {}
    }, []);
    
    // Track small-screen state for responsive rendering
    useEffect(() => {
        try {
            const update = () => {
                if (typeof window !== 'undefined') {
                    setIsSmall(window.innerWidth < 900);
                }
            };
            update();
            if (typeof window !== 'undefined') {
                window.addEventListener('resize', update);
                return () => window.removeEventListener('resize', update);
            }
        } catch {}
    }, []);
    
    // Persist UI state whenever it changes
    useEffect(() => {
        const payload = {
            isCollapsed,
            isHistoryVisible,
            isResourcesVisible,
            isPromptsVisible,
            isSettingsVisible,
        };
        try { localStorage.setItem('sidebarState', JSON.stringify(payload)); } catch {}
    }, [isCollapsed, isHistoryVisible, isResourcesVisible, isPromptsVisible, isSettingsVisible]);

    // Lock background scroll when the mobile drawer is open
    useEffect(() => {
        try {
            if (typeof window === 'undefined') return;
            const isSmall = window.innerWidth < 900;
            if (isSmall && !isCollapsed) {
                const prev = document.body.style.overflow;
                document.body.setAttribute('data-prev-overflow', prev || '');
                document.body.style.overflow = 'hidden';
            } else {
                const prev = document.body.getAttribute('data-prev-overflow') || '';
                document.body.style.overflow = prev;
                document.body.removeAttribute('data-prev-overflow');
            }
        } catch {}
        return () => {
            try {
                const prev = document.body.getAttribute('data-prev-overflow') || '';
                document.body.style.overflow = prev;
                document.body.removeAttribute('data-prev-overflow');
            } catch {}
        };
    }, [isCollapsed]);

    const handleToggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    const handleDeleteClick = (e, chatId) => {
        e.stopPropagation(); // Prevent chat selection
        if (confirmingDelete === chatId) {
            onDeleteChat(chatId);
            setConfirmingDelete(null);
        } else {
            setConfirmingDelete(chatId);
        }
    };

    const handleMouseLeave = (chatId) => {
        // Don't clear delete confirmation if settings menu is open
        if (confirmingDelete === chatId && settingsMenuOpen !== chatId) {
            setConfirmingDelete(null);
        }
    };

    const handleRenameClick = (e, chatId, currentTitle) => {
        e.stopPropagation(); // Prevent chat selection
        setRenamingChat(chatId);
        setRenameValue(currentTitle || '');
    };

    const handleRenameSubmit = (chatId) => {
        if (renameValue.trim() && renameValue !== history.find(chat => chat.id === chatId)?.title) {
            onRenameChat(chatId, renameValue.trim());
        }
        setRenamingChat(null);
        setRenameValue('');
    };

    const handleRenameCancel = () => {
        setRenamingChat(null);
        setRenameValue('');
    };

    const handleRenameKeyDown = (e, chatId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleRenameSubmit(chatId);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleRenameCancel();
        }
    };

    const handleSettingsClick = (e, chatId) => {
        e.stopPropagation();
        setSettingsMenuOpen(settingsMenuOpen === chatId ? null : chatId);
    };

    const handleSettingsOptionClick = (action, chatId, chatTitle) => {
        if (action === 'rename') {
            setSettingsMenuOpen(null);
            handleRenameClick({ stopPropagation: () => {} }, chatId, chatTitle);
        } else if (action === 'delete') {
            // Don't close menu on first delete click, only close after confirmation
            if (confirmingDelete === chatId) {
                // Second click - actually delete and close menu
                setSettingsMenuOpen(null);
                onDeleteChat(chatId);
                setConfirmingDelete(null);
            } else {
                // First click - just set confirmation state, keep menu open
                setConfirmingDelete(chatId);
            }
        }
    };

    // Close settings menu when clicking outside, but not during delete confirmation
    useEffect(() => {
        const handleClickOutside = () => {
            // Don't close menu if we're in delete confirmation mode
            if (confirmingDelete === null) {
                setSettingsMenuOpen(null);
            }
        };

        if (settingsMenuOpen) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [settingsMenuOpen, confirmingDelete]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if the click is outside the dropdown
            const dropdown = document.querySelector('.custom-dropdown');
            if (dropdown && dropdownOpen && !dropdown.contains(event.target)) {
                setDropdownOpen(false);
            }
        };

        if (dropdownOpen) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [dropdownOpen]);

    const filteredHistory = historyQuery
        ? history.filter((chat) => (chat.title || '').toLowerCase().includes(historyQuery.toLowerCase()))
        : history;

    const promptLabel = (p) => p.replace(/_/g, ' ').replace(/-/g, ' ');

    return (
        <aside id="sidebar" className={isCollapsed ? 'collapsed' : ''}>
            {/* Mobile backdrop to close the drawer by tapping outside */}
            {isSmall && !isCollapsed && (
                <button
                    className="sidebar-backdrop"
                    aria-label="Close sidebar"
                    onClick={() => setIsCollapsed(true)}
                />
            )}
            <button
                className="sidebar-toggle"
                onClick={handleToggleSidebar}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {isCollapsed ? '☰' : '×'}
            </button>
            {/* Mobile floating New Chat button */}
            {isSmall && (
                <button
                    className="new-chat-fab"
                    onClick={() => { 
                        onNewChat(); 
                        try { if (typeof window !== 'undefined' && window.innerWidth < 900) setIsCollapsed(true); } catch {}
                    }}
                    aria-label="New chat"
                    title="New Chat"
                >＋</button>
            )}
            <div className="sidebar-content-wrapper">
                <div className="sidebar-header">
                    <h2>The AI Cognition Protocol</h2>
                    <button
                        onClick={() => { 
                            onNewChat(); 
                            try { if (typeof window !== 'undefined' && window.innerWidth < 900) setIsCollapsed(true); } catch {}
                        }}
                        className="new-chat-btn"
                        title="New Chat"
                        aria-label="New chat"
                    >＋</button>
                </div>
                <div className="sidebar-content">
                    <div className="collapsible-section">
                        <h2 onClick={() => setIsHistoryVisible(!isHistoryVisible)} className="section-header" role="button" aria-expanded={isHistoryVisible}>
                            <span>Chat History</span>
                            <span className="section-meta">
                                <span className="count-badge" aria-label={`${history.length} chats`}>{history.length}</span>
                                <span className="chevron" aria-hidden>{isHistoryVisible ? '▼' : '►'}</span>
                            </span>
                        </h2>
                        {isHistoryVisible && (
                            <>
                                <div className="search-wrapper" role="search">
                                    <input
                                        className="search-input"
                                        type="text"
                                        value={historyQuery}
                                        onChange={(e) => setHistoryQuery(e.target.value)}
                                        placeholder="Search chats..."
                                        aria-label="Search chats"
                                    />
                                    {historyQuery && (
                                        <button
                                            className="clear-search"
                                            title="Clear search"
                                            aria-label="Clear search"
                                            onClick={() => setHistoryQuery('')}
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                                <ul className="history-list">
                                    {filteredHistory.map(chat => (
                                        <li 
                                            key={chat.id} 
                                            className={`history-item ${chat.id === activeChatId ? 'active' : ''} ${renamingChat === chat.id ? 'renaming' : ''}`}
                                            onClick={renamingChat === chat.id ? undefined : () => { 
                                                onSelectChat(chat.id); 
                                                try { if (typeof window !== 'undefined' && window.innerWidth < 900) setIsCollapsed(true); } catch {}
                                            }}
                                            onMouseLeave={() => handleMouseLeave(chat.id)}
                                        >
                                            {renamingChat === chat.id ? (
                                                <div className="rename-container">
                                                    <input
                                                        type="text"
                                                        value={renameValue}
                                                        onChange={(e) => setRenameValue(e.target.value)}
                                                        onKeyDown={(e) => handleRenameKeyDown(e, chat.id)}
                                                        onBlur={() => handleRenameSubmit(chat.id)}
                                                        className="rename-input"
                                                        autoFocus
                                                        placeholder="Enter chat title..."
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="chat-title">{chat.title}</span>
                                                    <div className="chat-settings">
                                                        <button 
                                                            className="chat-settings-btn"
                                                            onClick={(e) => handleSettingsClick(e, chat.id)}
                                                            title="Chat settings"
                                                            aria-label="Chat settings"
                                                        >
                                                            ⋯
                                                        </button>
                                                        {settingsMenuOpen === chat.id && (
                                                            <div className="settings-menu">
                                                                <button 
                                                                    className="settings-menu-item"
                                                                    onClick={() => handleSettingsOptionClick('rename', chat.id, chat.title)}
                                                                >
                                                                    <span className="menu-icon">✏️</span>
                                                                    Rename
                                                                </button>
                                                                <button 
                                                                    className={`settings-menu-item ${confirmingDelete === chat.id ? 'confirm-delete' : ''}`}
                                                                    onClick={() => handleSettingsOptionClick('delete', chat.id)}
                                                                >
                                                                    <span className="menu-icon">🗑️</span>
                                                                    {confirmingDelete === chat.id ? 'Sure?' : 'Delete'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                <div className="sidebar-actions">
                                    <button onClick={() => onDownload('md')} className="sidebar-btn">Export Chat (Markdown)</button>
                                    <button onClick={() => onDownload('pdf')} className="sidebar-btn">Export Chat (PDF)</button>
                                    <label htmlFor="upload-btn" className="sidebar-btn">
                                        Upload Chat (Markdown)
                                    </label>
                                    <input id="upload-btn" type="file" accept=".md,.markdown,text/markdown" onChange={onUpload} style={{ display: 'none' }} />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="collapsible-section">
                        <h2 onClick={() => setIsResourcesVisible(!isResourcesVisible)} className="section-header" role="button" aria-expanded={isResourcesVisible}>
                            <span>Learning Resources</span>
                            <span className="section-meta">
                                <span className="count-badge" aria-label={`${learningResources.length} resources`}>{learningResources.length}</span>
                                <span className="chevron" aria-hidden>{isResourcesVisible ? '▼' : '►'}</span>
                            </span>
                        </h2>
                        {isResourcesVisible && (
                            <ul className="history-list">
                                {learningResources.map(resource => (
                                    <li 
                                        key={resource.slug} 
                                        className="history-item"
                                        onClick={() => { 
                                            onSelectResource(resource.slug); 
                                            try { if (typeof window !== 'undefined' && window.innerWidth < 900) setIsCollapsed(true); } catch {}
                                        }}
                                    >
                                        {resource.title}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    
                    <div className="collapsible-section">
                        <h2 onClick={() => setIsPromptsVisible(!isPromptsVisible)} className="section-header" role="button" aria-expanded={isPromptsVisible}>
                            <span>System Prompts</span>
                            <span className="section-meta">
                                <span className="count-badge" aria-label={`${systemPrompts.length} prompts`}>{systemPrompts.length}</span>
                                <span className="chevron" aria-hidden>{isPromptsVisible ? '▼' : '►'}</span>
                            </span>
                        </h2>
                        {isPromptsVisible && (
                            <div className="system-prompt-dropdown-container">
                                {/* Custom dropdown with tooltip support */}
                                <div className="custom-dropdown">
                                    <button
                                        className="dropdown-toggle"
                                        onClick={() => setDropdownOpen(!dropdownOpen)}
                                    >
                                        {promptLabel(selectedSystemPrompt || "Cognitive Tiers With Delivery")}
                                        <span className="dropdown-arrow">{dropdownOpen ? '▲' : '▼'}</span>
                                    </button>
                                    {dropdownOpen && (
                                        <ul className="dropdown-menu">
                                            {systemPrompts.map(prompt => {
                                                // Generate descriptions for each prompt
                                                const promptDescriptions = {
                                                    "Cognitive_Tiers_With_Delivery": "A comprehensive prompt that implements cognitive tiers with structured delivery.",
                                                    "Cognitive_Tiers": "The core cognitive tiers framework without delivery structure, focusing on pure cognitive processing.",
                                                    "Cognitive_Tiers_Technical": "A more technical implementation of cognitive tiers.",
                                                    "Modes_Technical_v2": "Previously designed framework (depreciated), detailed analysis with heavy token use.",
                                                    "Modes_v2": "Previously designed framework (depreciated), analysis with moderate token use.",
                                                    "Modes": "Previously designed framework (depreciated), analysis with moderate-high token use.",
                                                    "Response_Generator": "Specialized prompt for generating responses to reddit posts. Designed to be used as follows: Socratic Lens analysis of original reddit post, then run 'Expository Trace' using Cognitive Tiers, then use this system prompt with 'Generate Responses'",
                                                    "Classic_AI": "Traditional AI 'You are a friendly helpful assistant'.",
                                                    "Socratic_Lens": "A short list of rules for the AI to follow. Includes a creative mode (initiated by prefixing your message with *, ask the AI for more details).",
                                                    "Socratic_Lens_v2": "A short list of rules for the AI to follow (v2 adds epistemic state and black swan analysis). Includes a creative mode (initiated by prefixing your message with *, ask the AI for more details).",
                                                    "Interactive_Story_Detective": "Interactive storytelling prompt. Initiate with 'Start'."
                                                };

                                                // Clean the prompt name for matching
                                                const cleanPromptName = prompt.replace(/_/g, '').replace(/-/g, '').replace(/\s+/g, '_');
                                                const description = promptDescriptions[cleanPromptName] ||
                                                                    "A system prompt designed for specialized interaction patterns.";

                                                // Handle tooltip positioning
                                                const handleMouseEnter = (e) => {
                                                    const item = e.currentTarget;
                                                    const tooltip = item.querySelector('.prompt-tooltip');

                                                    // Get item position
                                                    const rect = item.getBoundingClientRect();

                                                    // Position tooltip to the right of the dropdown
                                                    tooltip.style.left = `${rect.right + 12}px`;
                                                    tooltip.style.top = `${rect.top + rect.height / 2 - 20}px`;
                                                    tooltip.style.display = 'block';
                                                };

                                                const handleMouseLeave = (e) => {
                                                    const item = e.currentTarget;
                                                    const tooltip = item.querySelector('.prompt-tooltip');
                                                    tooltip.style.display = 'none';
                                                };

                                                return (
                                                    <li
                                                        key={prompt}
                                                        className={`dropdown-item ${prompt === selectedSystemPrompt ? 'active' : ''}`}
                                                        onClick={() => {
                                                            onSelectSystemPrompt(prompt);
                                                            setDropdownOpen(false);
                                                        }}
                                                        onMouseEnter={handleMouseEnter}
                                                        onMouseLeave={handleMouseLeave}
                                                    >
                                                        {promptLabel(prompt)}
                                                        <div className="prompt-tooltip">{description}</div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            
                                {selectedSystemPrompt === 'Custom Prompt' && (
                                     <button 
                                         onClick={onCustomPromptEdit} 
                                         className="sidebar-btn"
                                         style={{ marginTop: '12px', width: '100%' }}
                                     >
                                         ✏️ Edit Custom Prompt
                                     </button>
                            )}
                            </div>
                        )}
                    </div>
                    
                    <div className="collapsible-section">
                        <h2 onClick={() => setIsSettingsVisible(!isSettingsVisible)} className="section-header" role="button" aria-expanded={isSettingsVisible}>
                            <span>Settings</span>
                            <span className="section-meta">
                                <span className="chevron" aria-hidden>{isSettingsVisible ? '▼' : '►'}</span>
                            </span>
                        </h2>
                        {isSettingsVisible && (
                            <div className={`history-list settings-panel ${llmSettings?.useDeveloperKey ? 'subdued' : ''}`} style={{ padding: '8px' }}>
                                <label style={{ display: 'block', marginBottom: 6 }}>
                                    Provider
                                    <select
                                        value={llmSettings?.provider || 'google'}
                                        onChange={(e) => onUpdateLlmSettings({ provider: e.target.value })}
                                        style={{ width: '100%', marginTop: 4 }}
                                    >
                                        <option value="google">Google</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="anthropic">Anthropic</option>
                                        <option value="mistral">Mistral</option>
                                        <option value="glm">Z.ai</option>
                                    </select>
                                </label>
                                <label style={{ display: 'block', marginBottom: 6 }}>
                                    <input
                                        type="checkbox"
                                        className="devkey-toggle"
                                        checked={!!llmSettings?.useDeveloperKey}
                                        onChange={(e) => onUpdateLlmSettings({ useDeveloperKey: e.target.checked })}
                                        style={{ marginRight: 8 }}
                                    />
                                    Use developer key
                                </label>
                                <label style={{ display: 'block', marginBottom: 6 }}>
                                    Preset model
                                    <select
                                        value={providerModelPresets[llmSettings?.provider || 'google']?.includes(llmSettings?.models?.[llmSettings?.provider]) ? llmSettings?.models[llmSettings?.provider] : ''}
                                        onChange={(e) => onUpdateLlmSettings({ models: { ...(llmSettings?.models||{}), [llmSettings?.provider]: e.target.value } })}
                                        style={{ width: '100%', marginTop: 4 }}
                                    >
                                        <option value="">— Select a preset —</option>
                                        {providerModelPresets[llmSettings?.provider || 'google']?.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </label>
                                <label style={{ display: 'block', marginBottom: 6 }}>
                                    Temperature
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="2"
                                        className="temperature"
                                        value={typeof llmSettings?.temperature === 'number' ? llmSettings.temperature : 0.7}
                                        onChange={(e) => onUpdateLlmSettings({ temperature: Number(e.target.value) })}
                                        placeholder="0.7"
                                        style={{ width: '100%', marginTop: 4 }}
                                        disabled={!!llmSettings?.useProviderDefaultTemperature}
                                    />
                                </label>
                                <label style={{ display: 'block', marginBottom: 6 }}>
                                    <input
                                        type="checkbox"
                                        className="temptoggle"
                                        checked={!!llmSettings?.useProviderDefaultTemperature}
                                        onChange={(e) => onUpdateLlmSettings({ useProviderDefaultTemperature: e.target.checked })}
                                        style={{ marginRight: 8 }}
                                    />
                                    Use provider default temperature
                                </label>
                                <label style={{ display: 'block', marginBottom: 6 }}>
                                    Model
                                    <input
                                        type="text"
                                        value={llmSettings?.models?.[llmSettings?.provider] || ''}
                                        onChange={(e) => onUpdateLlmSettings({ models: { ...(llmSettings?.models||{}), [llmSettings?.provider]: e.target.value } })}
                                        placeholder={llmSettings?.provider === 'google' ? 'gemini-2.5-pro' : 'e.g., gpt-4o, claude-3-5'}
                                        style={{ width: '100%', marginTop: 4 }}
                                    />
                                </label>
                                <label style={{ display: 'block', marginBottom: 6 }}>
                                    API Key for {llmSettings?.provider?.toUpperCase()}
                                    <input
                                        type="text"
                                        autoComplete="off"
                                        value={llmSettings?.apiKeys?.[llmSettings?.provider] || ''}
                                        onChange={(e) => onUpdateLlmSettings({ apiKey: e.target.value })}
                                        placeholder={`Enter your ${llmSettings?.provider} API key (kept local)`}
                                        style={{ 
                                            width: '100%', 
                                            marginTop: 4,
                                            WebkitTextSecurity: 'disc',
                                            textSecurity: 'disc'
                                        }}
                                    />
                                </label>
                                {!llmSettings?.apiKeys?.[llmSettings?.provider] && (
                                    <p style={{ fontSize: 12, color: '#b94a48' }}>API key required for {llmSettings?.provider}. Add your key to use this provider.</p>
                                )}
                                <p style={{ fontSize: 12, color: '#888' }}>Your key stays in your browser storage and is sent only with requests.</p>
                            </div>
                        )}
                    </div>

                    <div className="sidebar-footer">
                        <button 
                            onClick={() => {
                                try { localStorage.removeItem('sidebarState'); } catch {}
                                setHistoryQuery('');
                                onResetPageState();
                            }}
                            className="reset-btn"
                            title="Reset all application state including chats, selections, and collapsed panels"
                        >
                            Reset Application State
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
