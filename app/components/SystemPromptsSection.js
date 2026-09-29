'use client';

import { useState, useEffect, useRef } from 'react';
import { DEFAULT_SYSTEM_PROMPT, isCustomPromptKey } from '../../lib/constants';

// One-line descriptions keyed by built-in prompt name (file name without .json), shown on hover.
const PROMPT_DESCRIPTIONS = {};

export const builtinLabel = (p) => (p || '').replace(/[_-]/g, ' ');

/** System prompt picker: built-in prompts + user-authored prompts, with create/edit/delete. */
export default function SystemPromptsSection({
    systemPrompts, customPrompts, selectedSystemPrompt, onSelectSystemPrompt,
    onCustomPromptEdit, onCreateCustomPrompt, onDeleteCustomPrompt
}) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [confirmDeleteKey, setConfirmDeleteKey] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!dropdownOpen) return;
        const handleClickOutside = (event) => {
            if (!containerRef.current?.contains(event.target)) {
                setDropdownOpen(false);
                setConfirmDeleteKey(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [dropdownOpen]);

    const selectedIsCustom = isCustomPromptKey(selectedSystemPrompt);
    const selectedCustom = selectedIsCustom ? customPrompts.find(p => p.key === selectedSystemPrompt) : null;
    const pick = (key) => {
        onSelectSystemPrompt(key);
        setDropdownOpen(false);
        setConfirmDeleteKey(null);
    };
    const handleDelete = (key) => {
        if (confirmDeleteKey !== key) return setConfirmDeleteKey(key);
        onDeleteCustomPrompt(key);
        setConfirmDeleteKey(null);
    };

    return (
        <div className="system-prompt-dropdown-container" ref={containerRef}>
            <div className="custom-dropdown">
                <button className="dropdown-toggle" onClick={() => setDropdownOpen(o => !o)}>
                    <span className="dropdown-label">
                        {selectedIsCustom && <span className="prompt-badge">custom</span>}
                        {selectedIsCustom ? selectedCustom?.name || 'Custom prompt' : builtinLabel(selectedSystemPrompt || DEFAULT_SYSTEM_PROMPT)}
                    </span>
                    <span className="dropdown-arrow">{dropdownOpen ? '▲' : '▼'}</span>
                </button>
                {dropdownOpen && (
                    <ul className="dropdown-menu">
                        <li className="dropdown-group">Built-in</li>
                        {systemPrompts.map(prompt => (
                            <li
                                key={prompt}
                                className={`dropdown-item ${prompt === selectedSystemPrompt ? 'active' : ''}`}
                                onClick={() => pick(prompt)}
                                title={PROMPT_DESCRIPTIONS[prompt] || 'Built-in system prompt.'}
                            >
                                {builtinLabel(prompt)}
                            </li>
                        ))}

                        <li className="dropdown-group">Your prompts</li>
                        {customPrompts.length === 0 && <li className="dropdown-empty">None yet. Create one below.</li>}
                        {customPrompts.map(p => (
                            <li key={p.key} className={`dropdown-item custom ${p.key === selectedSystemPrompt ? 'active' : ''}`} onClick={() => pick(p.key)}>
                                <span className="dropdown-item-name">{p.name}</span>
                                <span className="dropdown-item-actions" onClick={(e) => e.stopPropagation()}>
                                    <button className="mini-btn" title="Edit" onClick={() => { pick(p.key); onCustomPromptEdit(p.key); }}>✏️</button>
                                    <button className={`mini-btn ${confirmDeleteKey === p.key ? 'danger' : ''}`} title="Delete" onClick={() => handleDelete(p.key)}>
                                        {confirmDeleteKey === p.key ? 'Sure?' : '🗑️'}
                                    </button>
                                </span>
                            </li>
                        ))}
                        <li className="dropdown-item create" onClick={() => { setDropdownOpen(false); onCreateCustomPrompt(); }}>
                            ＋ New custom prompt
                        </li>
                    </ul>
                )}
            </div>

            <div className="prompt-actions">
                {selectedIsCustom && (
                    <button onClick={() => onCustomPromptEdit(selectedSystemPrompt)} className="sidebar-btn">
                        ✏️ Edit "{selectedCustom?.name || 'prompt'}"
                    </button>
                )}
                <button onClick={onCreateCustomPrompt} className="sidebar-btn">＋ New custom prompt</button>
            </div>
        </div>
    );
}
