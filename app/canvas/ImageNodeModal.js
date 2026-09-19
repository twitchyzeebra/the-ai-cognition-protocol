'use client';

import { useState, useEffect } from 'react';

export default function ImageNodeModal({ node, onClose, onUpdate, onDelete }) {
    const [titleValue, setTitleValue] = useState(node.title);
    const [imageUrlValue, setImageUrlValue] = useState(node.imageUrl || '');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        setTitleValue(node.title);
        setImageUrlValue(node.imageUrl || '');
    }, [node.title, node.imageUrl]);

    const handleSave = async () => {
        await onUpdate(node.id, {
            title: titleValue.trim() || 'Untitled',
            imageUrl: imageUrlValue.trim()
        });
        setIsEditing(false);
    };

    return (
        <div className="canvas-modal-overlay" onClick={onClose}>
            <div
                className="canvas-modal-content image-node-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="canvas-modal-header">
                    {isEditing ? (
                        <input
                            type="text"
                            value={titleValue}
                            onChange={(e) => setTitleValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                            placeholder="Image title"
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
                                        setImageUrlValue(node.imageUrl || '');
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
                        <div className="form-group">
                            <label style={{ marginBottom: '8px', display: 'block' }}>Image URL</label>
                            <input
                                type="text"
                                value={imageUrlValue}
                                onChange={(e) => setImageUrlValue(e.target.value)}
                                placeholder="https://example.com/image.jpg"
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    ) : node.imageUrl ? (
                        <img
                            src={node.imageUrl}
                            alt={node.title}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '70vh',
                                objectFit: 'contain',
                                borderRadius: '8px'
                            }}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
                            No image URL set
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
