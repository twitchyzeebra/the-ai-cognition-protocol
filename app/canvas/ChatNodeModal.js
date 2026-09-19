'use client';

import { useState, useEffect } from 'react';
import ChatNodeColumn from './ChatNodeColumn';

export default function ChatNodeModal({ node, onClose, onUpdateTitle, onDelete }) {
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState(node.title);
    const [llmSettings, setLlmSettings] = useState({});
    const [systemPrompt, setSystemPrompt] = useState('system-prompt');
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('pageState');
            if (stored) {
                const parsed = JSON.parse(stored);
                setLlmSettings(parsed.llmSettings || {});
                setSystemPrompt(parsed.selectedSystemPrompt || 'system-prompt');
            }
        } catch {}
        setIsReady(true);
    }, []);

    const handleTitleSave = async () => {
        if (titleValue.trim() && titleValue.trim() !== node.title) {
            await onUpdateTitle(node.id, titleValue.trim());
        }
        setEditingTitle(false);
    };

    return (
        <div className="canvas-modal-overlay" onClick={onClose}>
            <div
                className="canvas-modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '900px', height: '80vh' }}
            >
                <div className="canvas-modal-header">
                    {editingTitle ? (
                        <input
                            type="text"
                            value={titleValue}
                            onChange={(e) => setTitleValue(e.target.value)}
                            onBlur={handleTitleSave}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); }}
                            autoFocus
                            style={{
                                background: 'var(--input-bg)',
                                border: '1px solid var(--accent-color)',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                color: 'var(--text-color)',
                                fontSize: '18px',
                                fontWeight: 600,
                                flex: 1,
                                maxWidth: '400px'
                            }}
                        />
                    ) : (
                        <h2
                            onClick={() => { setEditingTitle(true); setTitleValue(node.title); }}
                            style={{ cursor: 'pointer' }}
                            title="Click to edit title"
                        >
                            {node.title}
                        </h2>
                    )}
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            title="Delete node"
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#ff6b6b',
                                fontSize: '18px',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                opacity: 0.8
                            }}
                        >
                            🗑️
                        </button>
                    )}
                    <button className="canvas-modal-close" onClick={onClose}>&times;</button>
                </div>

                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {isReady ? (
                        <ChatNodeColumn
                            chatId={node.chatId}
                            systemPrompt={systemPrompt}
                            llmSettings={llmSettings}
                        />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                            Loading...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
