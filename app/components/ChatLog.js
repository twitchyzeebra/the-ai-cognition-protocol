'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Memoized chat log to avoid re-rendering when parent updates unrelated state (e.g., input)
// Render a single message. Memoized so a message only re-renders when its content or role changes.
const formatMessageContent = (content) => {
    if (typeof content === 'string') return content;
    if (content == null) return '';
    if (typeof content === 'object') {
        try {
            return JSON.stringify(content);
        } catch {
            return String(content);
        }
    }
    return String(content);
};

const getMessageKey = (msg, index) => {
    if (msg.id) return msg.id;
    const preview = formatMessageContent(msg.content).slice(0, 30).replace(/\s+/g, '_');
    return `${msg.role}-${preview}-${index}`;
};

const Message = React.memo(function Message({ msg }) {
    return (
        <div className={`message ${msg.role}`}>
            <div className="content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {formatMessageContent(msg.content)}
                </ReactMarkdown>
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
        <div
            id="chat-log"
            ref={chatLogRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-busy={isLoading}
        >
            {messages.map((msg, index) => {
                return <Message key={getMessageKey(msg, index)} msg={msg} />;
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
