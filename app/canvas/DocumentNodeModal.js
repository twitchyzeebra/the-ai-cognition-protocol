'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function DocumentNodeModal({ node, onClose, onUpdate, onDelete }) {
    const [isEditing, setIsEditing] = useState(false);
    const [titleValue, setTitleValue] = useState(node.title);
    const [contentValue, setContentValue] = useState(node.content || '');

    useEffect(() => {
        setTitleValue(node.title);
        setContentValue(node.content || '');
    }, [node.title, node.content]);

    const handleSave = async () => {
        await onUpdate(node.id, {
            title: titleValue.trim() || 'Untitled',
            content: contentValue
        });
        setIsEditing(false);
    };

    const handleTitleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        }
    };

    return (
        <div className="canvas-modal-overlay" onClick={onClose}>
            <div
                className="canvas-modal-content document-node-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '900px' }}
            >
                <div className="canvas-modal-header">
                    {isEditing ? (
                        <input
                            type="text"
                            value={titleValue}
                            onChange={(e) => setTitleValue(e.target.value)}
                            onKeyDown={handleTitleKeyDown}
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
                                maxWidth: '500px'
                            }}
                        />
                    ) : (
                        <h2
                            onClick={() => setIsEditing(true)}
                            style={{ cursor: 'pointer' }}
                            title="Click to edit"
                        >
                            {node.title}
                        </h2>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {isEditing ? (
                            <>
                                <button
                                    className="btn-secondary"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setTitleValue(node.title);
                                        setContentValue(node.content || '');
                                    }}
                                    style={{ padding: '6px 12px', fontSize: '13px' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={handleSave}
                                    style={{ padding: '6px 12px', fontSize: '13px' }}
                                >
                                    Save
                                </button>
                            </>
                        ) : (
                            <button
                                className="btn-secondary"
                                onClick={() => setIsEditing(true)}
                                style={{ padding: '6px 12px', fontSize: '13px' }}
                            >
                                Edit
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={onDelete}
                                title="Delete node"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ff6b6b',
                                    fontSize: '16px',
                                    cursor: 'pointer',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    opacity: 0.8
                                }}
                            >
                                🗑️
                            </button>
                        )}
                        <button className="canvas-modal-close" onClick={onClose}>&times;</button>
                    </div>
                </div>

                <div className="canvas-modal-body">
                    {isEditing ? (
                        <textarea
                            value={contentValue}
                            onChange={(e) => setContentValue(e.target.value)}
                            placeholder="Write your markdown content here..."
                            autoFocus
                            style={{ minHeight: '400px' }}
                        />
                    ) : (
                        <div
                            style={{
                                lineHeight: 1.7,
                                fontSize: '15px'
                            }}
                        >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {contentValue || '_Empty document_'}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
