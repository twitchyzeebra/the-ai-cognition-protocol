'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

export default function AddNodeModal({ isOpen, onClose, onCreate, defaultPosition }) {
    const [step, setStep] = useState(1);
    const [selectedType, setSelectedType] = useState(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');

    if (!isOpen) return null;

    const resetForm = () => {
        setStep(1);
        setSelectedType(null);
        setTitle('');
        setContent('');
        setImageUrl('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleTypeSelect = (type) => {
        setSelectedType(type);
        setStep(2);
    };

    const handleCreate = async () => {
        if (!selectedType || !title.trim()) return;

        const nodeData = {
            type: selectedType,
            title: title.trim(),
            x: defaultPosition?.x ?? 100 + Math.random() * 200,
            y: defaultPosition?.y ?? 100 + Math.random() * 200
        };

        if (selectedType === 'document') {
            nodeData.content = content;
        } else if (selectedType === 'image') {
            nodeData.imageUrl = imageUrl;
        }

        await onCreate(nodeData);
        handleClose();
    };

    const modalContent = (
        <div className="canvas-modal-overlay" onClick={handleClose}>
            <div
                className="canvas-modal-content add-node-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="canvas-modal-header">
                    <h2>Add Node</h2>
                    <button className="canvas-modal-close" onClick={handleClose}>&times;</button>
                </div>

                <div className="canvas-modal-body">
                    {step === 1 ? (
                        <div className="add-node-types">
                            <button
                                className={`add-node-type-btn ${selectedType === 'chat' ? 'selected' : ''}`}
                                onClick={() => handleTypeSelect('chat')}
                            >
                                <span className="add-node-type-icon">💬</span>
                                <span>AI Chat</span>
                                <span style={{ fontSize: '11px', opacity: 0.6 }}>Start a new conversation</span>
                            </button>
                            <button
                                className={`add-node-type-btn ${selectedType === 'document' ? 'selected' : ''}`}
                                onClick={() => handleTypeSelect('document')}
                            >
                                <span className="add-node-type-icon">📄</span>
                                <span>Markdown Document</span>
                                <span style={{ fontSize: '11px', opacity: 0.6 }}>Write or paste text</span>
                            </button>
                            <button
                                className={`add-node-type-btn ${selectedType === 'image' ? 'selected' : ''}`}
                                onClick={() => handleTypeSelect('image')}
                            >
                                <span className="add-node-type-icon">🖼️</span>
                                <span>Image</span>
                                <span style={{ fontSize: '11px', opacity: 0.6 }}>Display an image</span>
                            </button>
                        </div>
                    ) : (
                        <div className="add-node-form">
                            <div className="form-group">
                                <label>Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter a title..."
                                    autoFocus
                                />
                            </div>

                            {selectedType === 'document' && (
                                <div className="form-group">
                                    <label>Content (Markdown supported)</label>
                                    <textarea
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="Write your document here..."
                                    />
                                </div>
                            )}

                            {selectedType === 'image' && (
                                <div className="form-group">
                                    <label>Image URL</label>
                                    <input
                                        type="text"
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                        placeholder="https://example.com/image.jpg"
                                    />
                                </div>
                            )}

                            {selectedType === 'chat' && (
                                <p style={{ fontSize: '13px', opacity: 0.7, margin: 0 }}>
                                    A new chat will be created. You can start chatting after creation.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {step === 2 && (
                    <div className="canvas-modal-actions">
                        <button className="btn-secondary" onClick={() => setStep(1)}>
                            Back
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleCreate}
                            disabled={!title.trim()}
                        >
                            Create
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
}
