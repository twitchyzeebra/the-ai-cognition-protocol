export default function CustomPromptEditor({ customPrompt, onCustomPromptChange, onCollapse }) {
    return (
        <div id="custom-prompt-column">
            <div className="column-header">
                <h2>Custom System Prompt</h2>
                <button
                    className="collapse-btn"
                    onClick={onCollapse}
                    title="Collapse custom prompt editor"
                >
                    ×
                </button>
            </div>
            <div className="custom-prompt-editor">
                <p className="editor-description">
                    Write your own system prompt to define how the AI should behave. This can be used after other system prompts.
                </p>
                <textarea
                    className="custom-prompt-textarea"
                    value={customPrompt}
                    onChange={(e) => onCustomPromptChange(e.target.value)}
                    placeholder="Enter your custom system prompt here...
                    Example: You are a helpful assistant who explains concepts clearly and concisely."
                    maxLength={10000}
                />
                <div className="char-counter">
                    {customPrompt.length} / 10,000
                </div>
                <p className="editor-hint">
                    Changes are saved automatically to your browser's local storage.
                </p>
            </div>
        </div>
    );
}
