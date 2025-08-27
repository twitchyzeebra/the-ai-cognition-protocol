'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Memoized chat log to avoid re-rendering when parent updates unrelated state (e.g., input)
// Render a single message. Memoized so a message only re-renders when its content or role changes.
const Message = React.memo(function Message({ msg }) {
    return (
        <div className={`message ${msg.role}`}>
            <div className="content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{typeof msg.content === 'string' ? msg.content : (msg.content == null ? '' : (typeof msg.content === 'object' ? JSON.stringify(msg.content) : String(msg.content)))}</ReactMarkdown>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Shallow compare role and content. If the message has an `id` use it for a faster check.
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
