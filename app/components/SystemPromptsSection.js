'use client';

import { useState, useEffect } from 'react';

const PROMPT_DESCRIPTIONS = {
    "Cognitive_Tiers_With_Delivery": "A comprehensive prompt that implements cognitive tiers with structured delivery.",
    "Cognitive_Tiers": "The core cognitive tiers framework without delivery structure, focusing on pure cognitive processing.",
    "Cognitive_Tiers_Technical": "A more technical implementation of cognitive tiers.",
    "Modes_Technical_v2": "Previously designed framework (depreciated), detailed analysis with heavy token use.",
    "Modes_v2": "Previously designed framework (depreciated), analysis with moderate token use.",
    "Modes": "Previously designed framework (depreciated), analysis with moderate-high token use.",
    "Response_Generator": "Specialized prompt for generating responses to reddit posts. Designed to be used as follows: Socratic Lens analysis of original reddit post, then run 'Expository Trace' using Cognitive Tiers, then use this system prompt with 'Generate Responses'",
    "Classic_AI": "Traditional AI 'You are a friendly helpful assistant'.",
    "Socratic_Lens": "A short list of rules for the AI to follow. Includes a creative mode (initiated by prefixing your message with *, ask the AI for more details).",
    "Socratic_Lens_v2": "A short list of rules for the AI to follow (v2 adds epistemic state and black swan analysis). Includes a creative mode (initiated by prefixing your message with *, ask the AI for more details).",
    "Interactive_Story_Detective": "Interactive storytelling prompt. Initiate with 'Start'."
};

const promptLabel = (p) => p.replace(/_/g, ' ').replace(/-/g, ' ');

const getPromptDescription = (prompt) => {
    const cleanPromptName = prompt.replace(/_/g, '').replace(/-/g, '').replace(/\s+/g, '_');
    return PROMPT_DESCRIPTIONS[cleanPromptName] || "A system prompt designed for specialized interaction patterns.";
};

/**
 * System prompts dropdown with tooltip descriptions.
 */
export default function SystemPromptsSection({
    systemPrompts,
    selectedSystemPrompt,
    onSelectSystemPrompt,
    onCustomPromptEdit
}) {
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            const dropdown = document.querySelector('.custom-dropdown');
            if (dropdown && dropdownOpen && !dropdown.contains(event.target)) {
                setDropdownOpen(false);
            }
        };

        if (dropdownOpen) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [dropdownOpen]);

    const handleMouseEnter = (e) => {
        const item = e.currentTarget;
        const tooltip = item.querySelector('.prompt-tooltip');
        const rect = item.getBoundingClientRect();
        tooltip.style.left = `${rect.right + 12}px`;
        tooltip.style.top = `${rect.top + rect.height / 2 - 20}px`;
        tooltip.style.display = 'block';
    };

    const handleMouseLeave = (e) => {
        const item = e.currentTarget;
        const tooltip = item.querySelector('.prompt-tooltip');
        tooltip.style.display = 'none';
    };

    return (
        <div className="system-prompt-dropdown-container">
            <div className="custom-dropdown">
                <button
                    className="dropdown-toggle"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                    {promptLabel(selectedSystemPrompt || "Cognitive Tiers With Delivery")}
                    <span className="dropdown-arrow">{dropdownOpen ? '▲' : '▼'}</span>
                </button>
                {dropdownOpen && (
                    <ul className="dropdown-menu">
                        {systemPrompts.map(prompt => (
                            <li
                                key={prompt}
                                className={`dropdown-item ${prompt === selectedSystemPrompt ? 'active' : ''}`}
                                onClick={() => {
                                    onSelectSystemPrompt(prompt);
                                    setDropdownOpen(false);
                                }}
                                onMouseEnter={handleMouseEnter}
                                onMouseLeave={handleMouseLeave}
                            >
                                {promptLabel(prompt)}
                                <div className="prompt-tooltip">{getPromptDescription(prompt)}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {selectedSystemPrompt === 'Custom Prompt' && (
                <button
                    onClick={onCustomPromptEdit}
                    className="sidebar-btn"
                    style={{ marginTop: '12px', width: '100%' }}
                >
                    ✏️ Edit Custom Prompt
                </button>
            )}
        </div>
    );
}
