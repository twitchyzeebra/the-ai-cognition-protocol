'use client';

import './Sidebar.css';

export default function Sidebar({ 
    history, 
    onNewChat, 
    onSelectChat, 
    activeChatId,
    onDownload,
    onUpload
}) {
    return (
        <aside id="sidebar">
            <div className="sidebar-header">
                <h2>Chat History</h2>
                <button onClick={onNewChat} className="new-chat-btn" title="New Chat">+</button>
            </div>
            <div className="sidebar-content">
                <ul className="history-list">
                    {history.map(chat => (
                        <li 
                            key={chat.id} 
                            className={`history-item ${chat.id === activeChatId ? 'active' : ''}`}
                            onClick={() => onSelectChat(chat.id)}
                        >
                            {chat.title}
                        </li>
                    ))}
                </ul>
            </div>
            <div className="sidebar-footer">
                <button onClick={onDownload} className="sidebar-btn">Download Chat</button>
                <label htmlFor="upload-btn" className="sidebar-btn">
                    Upload Chat
                </label>
                <input id="upload-btn" type="file" accept=".json" onChange={onUpload} style={{ display: 'none' }} />
            </div>
        </aside>
    );
}
