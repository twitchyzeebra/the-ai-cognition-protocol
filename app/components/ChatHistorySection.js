'use client';

import { useState, useEffect } from 'react';

/**
 * Chat history section with search, rename, delete, and export functionality.
 */
export default function ChatHistorySection({
    history,
    activeChatId,
    onSelectChat,
    onDeleteChat,
    onRenameChat,
    onDownload,
    onUpload,
    onCollapseSidebar,
    isSmall
}) {
    const [historyQuery, setHistoryQuery] = useState('');
    const [confirmingDelete, setConfirmingDelete] = useState(null);
    const [renamingChat, setRenamingChat] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [settingsMenuOpen, setSettingsMenuOpen] = useState(null);

    // Close settings menu when clicking outside, but not during delete confirmation
    useEffect(() => {
        const handleClickOutside = () => {
            if (confirmingDelete === null) {
                setSettingsMenuOpen(null);
            }
        };

        if (settingsMenuOpen) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [settingsMenuOpen, confirmingDelete]);

    const handleMouseLeave = (chatId) => {
        if (confirmingDelete === chatId && settingsMenuOpen !== chatId) {
            setConfirmingDelete(null);
        }
    };

    const handleRenameClick = (e, chatId, currentTitle) => {
        e.stopPropagation();
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
            if (confirmingDelete === chatId) {
                setSettingsMenuOpen(null);
                onDeleteChat(chatId);
                setConfirmingDelete(null);
            } else {
                setConfirmingDelete(chatId);
            }
        }
    };

    const filteredHistory = historyQuery
        ? history.filter((chat) => (chat.title || '').toLowerCase().includes(historyQuery.toLowerCase()))
        : history;

    const handleChatSelect = (chatId) => {
        onSelectChat(chatId);
        if (isSmall) onCollapseSidebar();
    };

    return (
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
                        onClick={renamingChat === chat.id ? undefined : () => handleChatSelect(chat.id)}
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
    );
}
