import { useRef, useState } from 'react';
import ChatLog from './ChatLog';
import { ACCEPTED_FILE_EXTENSIONS } from '../../lib/constants';

const TYPE_ICON = { text: '📄', document: '📑', image: '🖼️' };

function AttachmentChip({ file, onRemove }) {
    if (file.type === 'image' && file.status === 'ready') {
        return (
            <span className="image-preview-chip" title={file.name}>
                <img src={file.dataUrl} alt={file.name} className="image-preview-thumb" />
                <button className="file-chip-remove" onClick={onRemove} title="Remove image">×</button>
            </span>
        );
    }
    const status = file.status === 'processing' ? 'Reading…' : file.status === 'error' ? file.error || 'Failed' : file.meta || '';
    return (
        <span className={`file-chip ${file.status}`} title={file.status === 'error' ? file.error : file.name}>
            <span className="file-chip-icon">{TYPE_ICON[file.type] || '📄'}</span>
            <span className="file-chip-name">{file.name}</span>
            {status && <span className="file-chip-status">{status}</span>}
            <button className="file-chip-remove" onClick={onRemove} title="Remove file">×</button>
        </span>
    );
}

export default function ChatColumn({ chat, onCollapse, targetLabel }) {
    const fileInputRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const { files, usageLast: last, usageTotals: totals } = chat;
    const readyCount = files.readyFiles.length;
    const canSend = !chat.isLoading && !files.isProcessing && !(chat.activeChatId && !chat.messagesLoaded) && (chat.input.trim().length > 0 || readyCount > 0);

    const attach = (list) => { if (list?.length) files.addFiles(Array.from(list)); };
    const lastUsage = last && `Last: ${last.inputTokens} in + ${last.outputTokens} out = ${last.totalTokens} tokens`;
    const sessionUsage = `Session: ${totals.input} in + ${totals.output} out = ${totals.total} tokens`;

    return (
        <div
            id="chat-column"
            className={dragging ? 'drag-over' : ''}
            onDrop={(e) => { e.preventDefault(); setDragging(false); attach(e.dataTransfer.files); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        >
            <div className="column-header">
                <div className="column-title">
                    <h2>Chat</h2>
                    {targetLabel && <span className="target-label" title="Provider and model for the next message">{targetLabel}</span>}
                </div>
                <div className="header-actions">
                    {(last || totals.total > 0) && (
                        <div className="header-usage" title={last ? `${lastUsage} | ${sessionUsage}` : sessionUsage}>
                            {last && <div className="usage-line last">{lastUsage}</div>}
                            <div className="usage-line session">{sessionUsage}</div>
                        </div>
                    )}
                    <button className="collapse-btn" onClick={onCollapse} title="Collapse chat">×</button>
                </div>
            </div>

            <ChatLog messages={chat.messages} isLoading={chat.isLoading} chatLogRef={chat.chatLogRef} />

            {dragging && <div className="drop-hint">Drop files to attach (PDF, DOCX, XLSX, PPTX, text, code, images)</div>}

            {chat.notice && (
                <div className="chat-banner info">
                    <span>{chat.notice}</span>
                    <button className="banner-close" onClick={() => chat.setNotice('')} title="Dismiss">×</button>
                </div>
            )}
            {files.attachError && (
                <div className="chat-banner warn">
                    <span>{files.attachError}</span>
                    <button className="banner-close" onClick={files.dismissError} title="Dismiss">×</button>
                </div>
            )}

            {files.attachedFiles.length > 0 && (
                <div className="attached-files">
                    {files.attachedFiles.map(file => <AttachmentChip key={file.id} file={file} onRemove={() => files.removeFile(file.id)} />)}
                </div>
            )}

            <div id="chat-input">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_EXTENSIONS}
                    multiple
                    onChange={(e) => { attach(e.target.files); e.target.value = ''; }}
                    style={{ display: 'none' }}
                />
                <button
                    className="attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={chat.isLoading}
                    title="Attach files: PDF, Word, Excel, PowerPoint, text, code, images"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                </button>
                <textarea
                    value={chat.input}
                    onChange={(e) => chat.setInput(e.target.value)}
                    onPaste={(e) => {
                        // Paste images/files straight from the clipboard.
                        const pasted = Array.from(e.clipboardData?.items || []).filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
                        if (pasted.length) { e.preventDefault(); files.addFiles(pasted); }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (canSend) chat.sendMessage();
                        }
                    }}
                    placeholder={readyCount ? `Ask about the ${readyCount} attached file${readyCount === 1 ? '' : 's'}… (Enter to send)` : 'Type a message… (Enter to send, Shift+Enter for a new line)'}
                    disabled={chat.isLoading}
                    rows={1}
                />
                <button className="send-btn" onClick={chat.sendMessage} disabled={!canSend} title={files.isProcessing ? 'Reading attachments…' : 'Send (Enter)'}>
                    {chat.isLoading ? 'Thinking…' : files.isProcessing ? 'Reading…' : 'Send'}
                </button>
                {chat.isLoading && <button className="stop-btn" onClick={chat.stopGeneration}>Stop</button>}
                {!chat.isLoading && chat.hasRetry && chat.input === '' && (
                    <button onClick={chat.resend} title="Put your last message back in the box">Copy Last</button>
                )}
            </div>
        </div>
    );
}
