import { useRef, useCallback } from 'react';
import ChatLog from './ChatLog';

export default function ChatColumn({ chat, onCollapse }) {
    const fileInputRef = useRef(null);

    const handleFileSelect = useCallback((e) => {
        if (e.target.files?.length) {
            chat.addFiles(Array.from(e.target.files));
            e.target.value = ''; // reset so same file can be re-selected
        }
    }, [chat]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        if (e.dataTransfer.files?.length) {
            chat.addFiles(Array.from(e.dataTransfer.files));
        }
    }, [chat]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.currentTarget.classList.remove('drag-over');
    }, []);

    return (
        <div id="chat-column">
            <div className="column-header">
                <h2>Chat</h2>
                <div className="header-actions">
                    {(chat.usageLast || chat.usageTotals.total > 0) && (
                        <div
                            className="header-usage"
                            title={`${chat.usageLast ? `Last: ${chat.usageLast.inputTokens} in + ${chat.usageLast.outputTokens} out = ${chat.usageLast.totalTokens} tokens` : ''}${chat.usageLast ? ' | ' : ''}Session: ${chat.usageTotals.input} in + ${chat.usageTotals.output} out = ${chat.usageTotals.total} tokens`}
                        >
                            {chat.usageLast && (
                                <div className="usage-line last">
                                    Last: {chat.usageLast.inputTokens} in + {chat.usageLast.outputTokens} out = {chat.usageLast.totalTokens} tokens
                                </div>
                            )}
                            <div className="usage-line session">Session: {chat.usageTotals.input} in + {chat.usageTotals.output} out = {chat.usageTotals.total} tokens</div>
                        </div>
                    )}
                    <button
                        className="collapse-btn"
                        onClick={onCollapse}
                        title="Collapse chat"
                    >
                        ×
                    </button>
                </div>
            </div>
            <ChatLog messages={chat.messages} isLoading={chat.isLoading} chatLogRef={chat.chatLogRef} />
            {chat.attachedFiles.length > 0 && (
                <div className="attached-files">
                    {chat.attachedFiles.map((file, i) => (
                        file.type === 'image' ? (
                            <span key={i} className="image-preview-chip">
                                <img src={file.dataUrl} alt={file.name} className="image-preview-thumb" />
                                <button
                                    className="file-chip-remove"
                                    onClick={() => chat.removeFile(i)}
                                    title="Remove image"
                                >×</button>
                            </span>
                        ) : (
                            <span key={i} className="file-chip">
                                <span className="file-chip-name">{file.name}</span>
                                <button
                                    className="file-chip-remove"
                                    onClick={() => chat.removeFile(i)}
                                    title="Remove file"
                                >×</button>
                            </span>
                        )
                    ))}
                </div>
            )}
            <div
                id="chat-input"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.png,.jpg,.jpeg,.gif,.webp"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />
                <button
                    className="attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={chat.isLoading}
                    title="Attach file or image"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                </button>
                <textarea
                    value={chat.input}
                    onChange={(e) => chat.setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            chat.sendMessage();
                        }
                    }}
                    placeholder="Type your message..."
                    disabled={chat.isLoading}
                />
                <button onClick={chat.sendMessage} disabled={chat.isLoading || (chat.activeChatId && !chat.messagesLoaded)}>
                    {chat.isLoading ? 'Thinking...' : 'Send'}
                </button>
                {chat.isLoading && (
                    <button onClick={chat.stopGeneration}>
                        Stop
                    </button>
                )}
                {!chat.isLoading && chat.hasRetry && chat.input === '' && (
                    <button onClick={chat.resend}>
                        Copy Last
                    </button>
                )}
            </div>
        </div>
    );
}
