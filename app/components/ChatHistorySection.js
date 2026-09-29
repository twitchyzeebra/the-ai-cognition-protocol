'use client';

import { useState, useEffect, useRef } from 'react';

/** Chat list with search, rename, delete, and export/import. */
export default function ChatHistorySection({ chat, onSelectChat, onUpload }) {
    const [query, setQuery] = useState('');
    const [menu, setMenu] = useState(null);          // { id, confirmDelete }
    const [renaming, setRenaming] = useState(null);  // { id, value }
    const finishedRef = useRef(null);

    // Close the chat menu on outside clicks, except while a delete is awaiting confirmation.
    useEffect(() => {
        if (!menu || menu.confirmDelete) return;
        const close = (e) => { if (!e.target.closest?.('.chat-settings')) setMenu(null); };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [menu]);

    // Enter/Escape unmount the input, which can fire a late blur from the same render: finish only once.
    const finishRename = (save) => {
        if (finishedRef.current === renaming) return;
        finishedRef.current = renaming;
        const value = renaming.value.trim();
        if (save && value && value !== chat.chatHistory.find(c => c.id === renaming.id)?.title) chat.renameChat(renaming.id, value);
        setRenaming(null);
    };

    const handleDelete = (id) => {
        if (!menu.confirmDelete) return setMenu({ id, confirmDelete: true });
        setMenu(null);
        chat.deleteChat(id);
    };

    const needle = query.toLowerCase();
    const visible = query ? chat.chatHistory.filter(c => (c.title || '').toLowerCase().includes(needle)) : chat.chatHistory;

    return (
        <>
            <div className="search-wrapper" role="search">
                <input
                    className="search-input"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search chats..."
                    aria-label="Search chats"
                />
                {query && <button className="clear-search" title="Clear search" aria-label="Clear search" onClick={() => setQuery('')}>×</button>}
            </div>
            <ul className="history-list">
                {visible.map(c => {
                    const isRenaming = renaming?.id === c.id;
                    return (
                        <li
                            key={c.id}
                            className={`history-item ${c.id === chat.activeChatId ? 'active' : ''} ${isRenaming ? 'renaming' : ''}`}
                            onClick={isRenaming ? undefined : () => onSelectChat(c.id)}
                        >
                            {isRenaming ? (
                                <div className="rename-container">
                                    <input
                                        type="text"
                                        value={renaming.value}
                                        onChange={(e) => setRenaming({ id: c.id, value: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); finishRename(e.key === 'Enter'); }
                                        }}
                                        onBlur={() => finishRename(true)}
                                        className="rename-input"
                                        autoFocus
                                        placeholder="Enter chat title..."
                                    />
                                </div>
                            ) : (
                                <>
                                    <span className="chat-title">{c.title}</span>
                                    {/* Menu clicks must not select the chat */}
                                    <div className="chat-settings" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            className="chat-settings-btn"
                                            onClick={() => setMenu(m => (m?.id === c.id ? null : { id: c.id, confirmDelete: false }))}
                                            title="Chat settings"
                                            aria-label="Chat settings"
                                        >
                                            ⋯
                                        </button>
                                        {menu?.id === c.id && (
                                            <div className="settings-menu">
                                                <button className="settings-menu-item" onClick={() => { setMenu(null); setRenaming({ id: c.id, value: c.title || '' }); }}>
                                                    <span className="menu-icon">✏️</span>
                                                    Rename
                                                </button>
                                                <button className={`settings-menu-item ${menu.confirmDelete ? 'confirm-delete' : ''}`} onClick={() => handleDelete(c.id)}>
                                                    <span className="menu-icon">🗑️</span>
                                                    {menu.confirmDelete ? 'Sure?' : 'Delete'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </li>
                    );
                })}
            </ul>
            <div className="sidebar-actions">
                <button onClick={() => chat.downloadChat('md')} className="sidebar-btn">Export Chat (Markdown)</button>
                <button onClick={() => chat.downloadChat('pdf')} className="sidebar-btn">Export Chat (PDF)</button>
                <label htmlFor="upload-btn" className="sidebar-btn">Upload Chat (Markdown)</label>
                <input id="upload-btn" type="file" accept=".md,.markdown,text/markdown" onChange={onUpload} style={{ display: 'none' }} />
            </div>
        </>
    );
}
