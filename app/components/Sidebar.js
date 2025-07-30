'use client';

import { useState } from 'react';
import './Sidebar.css';

export default function Sidebar({ 
    history, 
    onNewChat, 
    onSelectChat, 
    activeChatId,
    onDownload,
    onUpload,
    learningResources,
    onSelectResource,
    onDeleteChat
}) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(true);
    const [isResourcesVisible, setIsResourcesVisible] = useState(true);
    const [confirmingDelete, setConfirmingDelete] = useState(null);

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
        if (confirmingDelete === chatId) {
            setConfirmingDelete(null);
        }
    };

    return (
        <aside id="sidebar" className={isCollapsed ? 'collapsed' : ''}>
            <div className="sidebar-toggle" onClick={handleToggleSidebar}>
                {isCollapsed ? '»' : '«'}
            </div>
            <div className="sidebar-content-wrapper">
                <div className="sidebar-header">
                    <h2>The AI Cognition Protocol</h2>
                    <button onClick={onNewChat} className="new-chat-btn" title="New Chat">+</button>
                </div>
                <div className="sidebar-content">
                    <div className="collapsible-section">
                        <h2 onClick={() => setIsHistoryVisible(!isHistoryVisible)}>
                            Chat History {isHistoryVisible ? '▼' : '►'}
                        </h2>
                        {isHistoryVisible && (
                            <>
                                <ul className="history-list">
                                    {history.map(chat => (
                                        <li 
                                            key={chat.id} 
                                            className={`history-item ${chat.id === activeChatId ? 'active' : ''}`}
                                            onClick={() => onSelectChat(chat.id)}
                                            onMouseLeave={() => handleMouseLeave(chat.id)}
                                        >
                                            <span className="chat-title">{chat.title}</span>
                                            <button 
                                                className="delete-chat-btn"
                                                onClick={(e) => handleDeleteClick(e, chat.id)}
                                            >
                                                {confirmingDelete === chat.id ? 'Sure?' : '🗑️'}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                <div className="sidebar-actions">
                                    <button onClick={onDownload} className="sidebar-btn">Download Chat</button>
                                    <label htmlFor="upload-btn" className="sidebar-btn">
                                        Upload Chat
                                    </label>
                                    <input id="upload-btn" type="file" accept=".json" onChange={onUpload} style={{ display: 'none' }} />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="collapsible-section">
                        <h2 onClick={() => setIsResourcesVisible(!isResourcesVisible)}>
                            Learning Resources {isResourcesVisible ? '▼' : '►'}
                        </h2>
                        {isResourcesVisible && (
                            <ul className="history-list">
                                {learningResources.map(resource => (
                                    <li 
                                        key={resource.slug} 
                                        className="history-item"
                                        onClick={() => onSelectResource(resource.slug)}
                                    >
                                        {resource.title}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
}
