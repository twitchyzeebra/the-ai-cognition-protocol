'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function toDisplayString(val) {
    if (typeof val === 'string') return val;
    if (val == null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

const FILE_ICON = {
    text: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    document: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
};

// Render a single message. Memoized so a message only re-renders when its content or role changes.
const Message = React.memo(function Message({ msg }) {
    // Use displayContent (user-typed text only) when available, otherwise fall back to full content
    const text = toDisplayString(msg.displayContent ?? msg.content);
    const files = msg.files;   // array of { name, type } if files were attached
    const images = msg.images; // array of { name, dataUrl } if images were attached

    const textFiles = files?.filter(f => f.type !== 'image');
    const hasTextFiles = textFiles && textFiles.length > 0;

    return (
        <div className={`message ${msg.role}`}>
            <div className="content">
                {images && images.length > 0 && (
                    <div className="msg-images">
                        {images.map((img, i) => (
                            <img key={i} src={img.dataUrl} alt={img.name} className="msg-image-thumb" title={img.name} />
                        ))}
                    </div>
                )}
                {hasTextFiles && (
                    <div className="msg-file-chips">
                        {textFiles.map((f, i) => (
                            <span key={i} className="msg-file-chip" title={f.type === 'document' ? 'Text extracted in your browser' : 'Text file'}>
                                {FILE_ICON[f.type] || FILE_ICON.text}
                                {f.name}
                            </span>
                        ))}
                    </div>
                )}
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
            {msg.role === 'assistant' && msg.model && (
                <div className="msg-meta" title="Model that produced this reply">{msg.model}</div>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    if (prevProps.msg.id && nextProps.msg.id) {
        return prevProps.msg.id === nextProps.msg.id
            && prevProps.msg.content === nextProps.msg.content
            && prevProps.msg.model === nextProps.msg.model;
    }
    return prevProps.msg.role === nextProps.msg.role
        && prevProps.msg.content === nextProps.msg.content
        && prevProps.msg.model === nextProps.msg.model;
});

const ChatLog = React.memo(function ChatLog({ messages, isLoading, chatLogRef }) {
    return (
        <div id="chat-log" ref={chatLogRef}>
            {messages.length === 0 && !isLoading && (
                <div className="chat-empty">
                    <p>Start a conversation, or drop a file here.</p>
                    <p className="chat-empty-sub">PDF, Word, Excel, PowerPoint, text, code and images are supported.</p>
                </div>
            )}
            {messages.map((msg, index) => {
                const key = msg.id || `${msg.role}-${(msg.content || '').slice(0,30).replace(/\s+/g, '_')}-${index}`;
                return <Message key={key} msg={msg} />;
            })}
            {isLoading && (
                <div className="message assistant">
                    <div className="loader"></div>
                </div>
            )}
        </div>
    );
});

export default ChatLog;
