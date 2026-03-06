'use client';

import Link from 'next/link';
import { useSidebarState } from '../hooks/useSidebarState';
import CollapsibleSection from './CollapsibleSection';
import ChatHistorySection from './ChatHistorySection';
import SystemPromptsSection from './SystemPromptsSection';
import SettingsPanel from './SettingsPanel';

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
    const {
        isCollapsed,
        isSmall,
        isHistoryVisible,
        isResourcesVisible,
        isPromptsVisible,
        isSettingsVisible,
        setIsHistoryVisible,
        setIsResourcesVisible,
        setIsPromptsVisible,
        setIsSettingsVisible,
        toggleSidebar,
        collapseSidebar,
        clearSidebarState,
    } = useSidebarState();

    const handleNewChat = () => {
        onNewChat();
        if (isSmall) collapseSidebar();
    };

    const handleSelectResource = (slug) => {
        onSelectResource(slug);
        if (isSmall) collapseSidebar();
    };

    const handleReset = () => {
        clearSidebarState();
        onResetPageState();
    };

    return (
        <aside id="sidebar" className={isCollapsed ? 'collapsed' : ''}>
            {/* Mobile backdrop to close the drawer by tapping outside */}
            {isSmall && !isCollapsed && (
                <button
                    className="sidebar-backdrop"
                    aria-label="Close sidebar"
                    onClick={collapseSidebar}
                />
            )}

            <button
                className="sidebar-toggle"
                onClick={toggleSidebar}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {isCollapsed ? '☰' : '×'}
            </button>

            {/* Mobile floating New Chat button */}
            {isSmall && (
                <button
                    className="new-chat-fab"
                    onClick={handleNewChat}
                    aria-label="New chat"
                    title="New Chat"
                >＋</button>
            )}

            <div className="sidebar-content-wrapper">
                <div className="sidebar-header">
                    <h2>The AI Cognition Protocol</h2>
                    <button
                        onClick={handleNewChat}
                        className="new-chat-btn"
                        title="New Chat"
                        aria-label="New chat"
                    >＋</button>
                </div>

                <div className="sidebar-content">
                    <CollapsibleSection
                        title="Chat History"
                        isVisible={isHistoryVisible}
                        onToggle={() => setIsHistoryVisible(!isHistoryVisible)}
                        count={history.length}
                    >
                        <ChatHistorySection
                            history={history}
                            activeChatId={activeChatId}
                            onSelectChat={onSelectChat}
                            onDeleteChat={onDeleteChat}
                            onRenameChat={onRenameChat}
                            onDownload={onDownload}
                            onUpload={onUpload}
                            onCollapseSidebar={collapseSidebar}
                            isSmall={isSmall}
                        />
                    </CollapsibleSection>

                    <CollapsibleSection
                        title="Learning Resources"
                        isVisible={isResourcesVisible}
                        onToggle={() => setIsResourcesVisible(!isResourcesVisible)}
                        count={learningResources.length}
                    >
                        <ul className="history-list">
                            {learningResources.map(resource => (
                                <li
                                    key={resource.slug}
                                    className="history-item"
                                    onClick={() => handleSelectResource(resource.slug)}
                                >
                                    {resource.title}
                                </li>
                            ))}
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection
                        title="System Prompts"
                        isVisible={isPromptsVisible}
                        onToggle={() => setIsPromptsVisible(!isPromptsVisible)}
                        count={systemPrompts.length}
                    >
                        <SystemPromptsSection
                            systemPrompts={systemPrompts}
                            selectedSystemPrompt={selectedSystemPrompt}
                            onSelectSystemPrompt={onSelectSystemPrompt}
                            onCustomPromptEdit={onCustomPromptEdit}
                        />
                    </CollapsibleSection>

                    <CollapsibleSection
                        title="Settings"
                        isVisible={isSettingsVisible}
                        onToggle={() => setIsSettingsVisible(!isSettingsVisible)}
                    >
                        <SettingsPanel
                            llmSettings={llmSettings}
                            onUpdateLlmSettings={onUpdateLlmSettings}
                        />
                    </CollapsibleSection>

                    <div className="sidebar-footer">
                        <button
                            onClick={handleReset}
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
