'use client';

import { useRef, useState } from 'react';

/**
 * Editor for one user-authored system prompt.
 * @param {{ prompt: {id:number,name:string,content:string}, onChange: (changes) => void,
 *           onDelete: () => void, onCollapse: () => void }} props
 */
export default function CustomPromptEditor({ prompt, onChange, onDelete, onCollapse }) {
    const fileRef = useRef(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    if (!prompt) {
        return (
            <div id="custom-prompt-column">
                <div className="column-header">
                    <h2>Custom System Prompt</h2>
                    <button className="collapse-btn" onClick={onCollapse} title="Close editor">×</button>
                </div>
                <p className="editor-description">Select or create a custom prompt in the sidebar to edit it here.</p>
            </div>
        );
    }

    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const text = await file.text();
            onChange({ content: text, ...(prompt.content ? {} : { name: prompt.name === 'Untitled Prompt' ? file.name.replace(/\.[^.]+$/, '') : prompt.name }) });
        } catch (err) {
            alert(`Could not read ${file.name}: ${err.message}`);
        }
    };

    const handleExport = () => {
        const blob = new Blob([prompt.content || ''], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(prompt.name || 'prompt').replace(/[\\/:*?"<>|]/g, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div id="custom-prompt-column">
            <div className="column-header">
                <h2>Custom System Prompt</h2>
                <button className="collapse-btn" onClick={onCollapse} title="Close editor">×</button>
            </div>
            <div className="custom-prompt-editor">
                <label className="editor-field">
                    <span>Name</span>
                    <input
                        type="text"
                        className="editor-name-input"
                        value={prompt.name}
                        onChange={(e) => onChange({ name: e.target.value })}
                        placeholder="e.g. Socratic tutor"
                    />
                </label>

                <div className="editor-toolbar">
                    <button className="sidebar-btn" onClick={() => fileRef.current?.click()} title="Load prompt text from a .txt or .md file">
                        📂 Import from file
                    </button>
                    <button className="sidebar-btn" onClick={handleExport} disabled={!prompt.content} title="Download prompt as .txt">
                        💾 Export
                    </button>
                    <button
                        className={`sidebar-btn ${confirmDelete ? 'danger' : ''}`}
                        onClick={() => { if (confirmDelete) { onDelete(); } else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); } }}
                        title="Delete this prompt"
                    >
                        {confirmDelete ? 'Click again to delete' : '🗑️ Delete'}
                    </button>
                    <input ref={fileRef} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" onChange={handleImport} style={{ display: 'none' }} />
                </div>

                <textarea
                    className="custom-prompt-textarea"
                    value={prompt.content}
                    onChange={(e) => onChange({ content: e.target.value })}
                    placeholder={'Write the system prompt here.\n\nExample: You are a tutor who answers with one clarifying question before explaining.'}
                />
                <div className="char-counter">{prompt.content.length.toLocaleString()} characters</div>
                <p className="editor-hint">
                    Saved automatically to this browser. Select it in the sidebar to use it for new messages.
                </p>
            </div>
        </div>
    );
}
