'use client';

import { useEffect, useState } from 'react';
import ChatHistorySection from './ChatHistorySection';
import SystemPromptsSection from './SystemPromptsSection';
import SettingsPanel from './SettingsPanel';

const SMALL_SCREEN = 900;
const DEFAULT_STATE = { isCollapsed: false, isHistoryVisible: true, isResourcesVisible: false, isPromptsVisible: false, isSettingsVisible: false };

/** Sidebar collapse + section visibility, persisted to localStorage.sidebarState. */
function useSidebarState() {
    const [state, setState] = useState(DEFAULT_STATE);
    const [isSmall, setIsSmall] = useState(false);

    useEffect(() => {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem('sidebarState')) || {}; } catch { /* use defaults */ }
        const restored = Object.fromEntries(Object.keys(DEFAULT_STATE).filter(k => typeof saved[k] === 'boolean').map(k => [k, saved[k]]));
        // Default to collapsed on small screens if there is no saved preference.
        if (restored.isCollapsed === undefined && window.innerWidth < SMALL_SCREEN) restored.isCollapsed = true;
        setState(s => ({ ...s, ...restored }));

        const onResize = () => setIsSmall(window.innerWidth < SMALL_SCREEN);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        try { localStorage.setItem('sidebarState', JSON.stringify(state)); } catch { /* storage full or disabled */ }
    }, [state]);

    // Lock background scroll while the mobile drawer is open.
    useEffect(() => {
        document.body.style.overflow = isSmall && !state.isCollapsed ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isSmall, state.isCollapsed]);

    const toggle = (key) => setState(s => ({ ...s, [key]: !s[key] }));
    const collapse = () => setState(s => ({ ...s, isCollapsed: true }));
    return { ...state, isSmall, toggle, collapse };
}

function Section({ title, isVisible, onToggle, count, children }) {
    return (
        <div className="collapsible-section">
            <h2 onClick={onToggle} className="section-header" role="button" aria-expanded={isVisible}>
                <span>{title}</span>
                <span className="section-meta">
                    {count != null && <span className="count-badge" aria-label={`${count} items`}>{count}</span>}
                    <span className="chevron" aria-hidden>{isVisible ? '▼' : '►'}</span>
                </span>
            </h2>
            {isVisible && children}
        </div>
    );
}

/**
 * @param chat      useChat() result (history, active chat, rename/delete/export)
 * @param prompts   props for SystemPromptsSection
 * @param settings  props for SettingsPanel
 */
export default function Sidebar({
    chat, onNewChat, onSelectChat, onUpload, learningResources, onSelectResource,
    prompts, settings, settingsNeedAttention, onResetPageState
}) {
    const ui = useSidebarState();
    // On small screens the sidebar is a drawer: close it after navigating.
    const thenClose = (fn) => (...args) => { fn(...args); if (ui.isSmall) ui.collapse(); };
    const newChat = thenClose(onNewChat);

    return (
        <aside id="sidebar" className={ui.isCollapsed ? 'collapsed' : ''}>
            {/* Mobile backdrop: tap outside the drawer to close it */}
            {ui.isSmall && !ui.isCollapsed && <button className="sidebar-backdrop" aria-label="Close sidebar" onClick={ui.collapse} />}

            <button
                className="sidebar-toggle"
                onClick={() => ui.toggle('isCollapsed')}
                aria-label={ui.isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={ui.isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {ui.isCollapsed ? '☰' : '×'}
            </button>

            {ui.isSmall && <button className="new-chat-fab" onClick={newChat} aria-label="New chat" title="New Chat">＋</button>}

            <div className="sidebar-content-wrapper">
                <div className="sidebar-header">
                    <h2>The AI Cognition Protocol</h2>
                    <button onClick={newChat} className="new-chat-btn" title="New Chat" aria-label="New chat">＋</button>
                </div>

                <div className="sidebar-content">
                    <Section title="Chat History" isVisible={ui.isHistoryVisible} onToggle={() => ui.toggle('isHistoryVisible')} count={chat.chatHistory.length}>
                        <ChatHistorySection chat={chat} onSelectChat={thenClose(onSelectChat)} onUpload={onUpload} />
                    </Section>

                    <Section title="Learning Resources" isVisible={ui.isResourcesVisible} onToggle={() => ui.toggle('isResourcesVisible')} count={learningResources.length}>
                        <ul className="history-list">
                            {learningResources.map(resource => (
                                <li key={resource.slug} className="history-item" onClick={thenClose(() => onSelectResource(resource.slug))}>
                                    {resource.title}
                                </li>
                            ))}
                        </ul>
                    </Section>

                    <Section title="System Prompts" isVisible={ui.isPromptsVisible} onToggle={() => ui.toggle('isPromptsVisible')} count={prompts.systemPrompts.length + prompts.customPrompts.length}>
                        <SystemPromptsSection {...prompts} />
                    </Section>

                    <Section title={settingsNeedAttention ? 'Settings ⚠' : 'Settings'} isVisible={ui.isSettingsVisible} onToggle={() => ui.toggle('isSettingsVisible')}>
                        <SettingsPanel {...settings} />
                    </Section>

                    <div className="sidebar-footer">
                        <button
                            onClick={onResetPageState}
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
