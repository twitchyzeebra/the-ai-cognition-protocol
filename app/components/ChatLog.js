'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Memoized chat log to avoid re-rendering when parent updates unrelated state (e.g., input)
// Render a single message. Memoized so a message only re-renders when its content or role changes.
function toDisplayString(val) {
    if (typeof val === 'string') return val;
    if (val == null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

const Message = React.memo(function Message({ msg }) {
    // Use displayContent (user-typed text only) when available, otherwise fall back to full content
    const text = toDisplayString(msg.displayContent ?? msg.content);
    const files = msg.files;   // array of { name, type } if files were attached
    const images = msg.images; // array of { name, dataUrl } if images were attached

    // Separate text-file chips from image-file chips
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
                            <span key={i} className="msg-file-chip">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                {f.name}
                            </span>
                        ))}
                    </div>
                )}
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    if (prevProps.msg.id && nextProps.msg.id) return prevProps.msg.id === nextProps.msg.id && prevProps.msg.content === nextProps.msg.content;
    return prevProps.msg.role === nextProps.msg.role && prevProps.msg.content === nextProps.msg.content;
});

const ChatLog = React.memo(function ChatLog({ messages, isLoading, chatLogRef }) {
    return (
        <div id="chat-log" ref={chatLogRef}>
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
