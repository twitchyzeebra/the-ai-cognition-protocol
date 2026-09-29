'use client';

import { useEffect, useRef, useState } from 'react';
import { downloadText, safeFilename } from '../utils/helpers';

/**
 * Editor for one user-authored system prompt.
 * @param {{ prompt: {id:number,name:string,content:string}, onChange: (changes) => void,
 *           onDelete: () => void, onCollapse: () => void }} props
 */
export default function CustomPromptEditor({ prompt, onChange, onDelete, onCollapse }) {
    const fileRef = useRef(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    // The delete confirmation expires after 3 seconds.
    useEffect(() => {
        if (!confirmDelete) return;
        const timer = setTimeout(() => setConfirmDelete(false), 3000);
        return () => clearTimeout(timer);
    }, [confirmDelete]);

    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const content = await file.text();
            // A still-empty, unnamed prompt takes the file's name.
            const rename = !prompt.content && prompt.name === 'Untitled Prompt';
            onChange({ content, ...(rename && { name: file.name.replace(/\.[^.]+$/, '') }) });
        } catch (err) {
            alert(`Could not read ${file.name}: ${err.message}`);
        }
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
                    <button
                        className="sidebar-btn"
                        onClick={() => downloadText(prompt.content || '', `${safeFilename(prompt.name, 'prompt')}.txt`)}
                        disabled={!prompt.content}
                        title="Download prompt as .txt"
                    >
                        💾 Export
                    </button>
                    <button
                        className={`sidebar-btn ${confirmDelete ? 'danger' : ''}`}
                        onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
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
                <p className="editor-hint">Saved automatically to this browser. Select it in the sidebar to use it for new messages.</p>
            </div>
        </div>
    );
}
