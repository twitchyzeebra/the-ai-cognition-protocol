'use client';

import { useState, useEffect, useRef } from 'react';
import { DEFAULT_SYSTEM_PROMPT } from '../../lib/constants';
import { isCustomPromptKey } from '../hooks/useCustomPrompts';

const PROMPT_DESCRIPTIONS = {
    // Add one-line descriptions keyed by built-in prompt name (file name without .json).
};

export const builtinLabel = (p) => (p || '').replace(/_/g, ' ').replace(/-/g, ' ');

const getPromptDescription = (prompt) =>
    PROMPT_DESCRIPTIONS[prompt] || 'Built-in system prompt.';

/**
 * System prompt picker: built-in prompts + user-authored prompts, with create/edit/delete.
 */
export default function SystemPromptsSection({
    systemPrompts,
    customPrompts,
    selectedSystemPrompt,
    onSelectSystemPrompt,
    onCustomPromptEdit,
    onCreateCustomPrompt,
    onDeleteCustomPrompt
}) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [confirmDeleteKey, setConfirmDeleteKey] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!dropdownOpen) return;
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setDropdownOpen(false);
                setConfirmDeleteKey(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [dropdownOpen]);

    const showTooltip = (e) => {
        const tooltip = e.currentTarget.querySelector('.prompt-tooltip');
        if (!tooltip) return;
        const rect = e.currentTarget.getBoundingClientRect();
        tooltip.style.left = `${rect.right + 12}px`;
        tooltip.style.top = `${rect.top + rect.height / 2 - 20}px`;
        tooltip.style.display = 'block';
    };
    const hideTooltip = (e) => {
        const tooltip = e.currentTarget.querySelector('.prompt-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    };

    const selectedIsCustom = isCustomPromptKey(selectedSystemPrompt);
    const selectedCustom = selectedIsCustom ? customPrompts.find(p => p.key === selectedSystemPrompt) : null;
    const currentLabel = selectedIsCustom
        ? (selectedCustom?.name || 'Custom prompt')
        : builtinLabel(selectedSystemPrompt || DEFAULT_SYSTEM_PROMPT);

    const pick = (key) => {
        onSelectSystemPrompt(key);
        setDropdownOpen(false);
        setConfirmDeleteKey(null);
    };

    return (
        <div className="system-prompt-dropdown-container" ref={containerRef}>
            <div className="custom-dropdown">
                <button className="dropdown-toggle" onClick={() => setDropdownOpen(o => !o)}>
                    <span className="dropdown-label">
                        {selectedIsCustom && <span className="prompt-badge">custom</span>}
                        {currentLabel}
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
                                onMouseEnter={showTooltip}
                                onMouseLeave={hideTooltip}
                            >
                                {builtinLabel(prompt)}
                                <div className="prompt-tooltip">{getPromptDescription(prompt)}</div>
                            </li>
                        ))}

                        <li className="dropdown-group">Your prompts</li>
                        {customPrompts.length === 0 && (
                            <li className="dropdown-empty">None yet. Create one below.</li>
                        )}
                        {customPrompts.map(p => (
                            <li
                                key={p.key}
                                className={`dropdown-item custom ${p.key === selectedSystemPrompt ? 'active' : ''}`}
                                onClick={() => pick(p.key)}
                            >
                                <span className="dropdown-item-name">{p.name}</span>
                                <span className="dropdown-item-actions">
                                    <button
                                        className="mini-btn"
                                        title="Edit"
                                        onClick={(e) => { e.stopPropagation(); pick(p.key); onCustomPromptEdit(p.key); }}
                                    >✏️</button>
                                    <button
                                        className={`mini-btn ${confirmDeleteKey === p.key ? 'danger' : ''}`}
                                        title="Delete"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirmDeleteKey === p.key) {
                                                onDeleteCustomPrompt(p.key);
                                                setConfirmDeleteKey(null);
                                            } else {
                                                setConfirmDeleteKey(p.key);
                                            }
                                        }}
                                    >{confirmDeleteKey === p.key ? 'Sure?' : '🗑️'}</button>
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
                <button onClick={onCreateCustomPrompt} className="sidebar-btn">
                    ＋ New custom prompt
                </button>
            </div>
        </div>
    );
}
