import ChatLog from './ChatLog';

export default function ChatColumn({ chat, onCollapse }) {
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
            <div id="chat-input">
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
