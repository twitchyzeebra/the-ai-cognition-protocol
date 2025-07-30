'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './globals.css';

export default function Home() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatLogRef = useRef(null);

    useEffect(() => {
        // Auto-scroll to the bottom of the chat log
        if (chatLogRef.current) {
            chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        let aiMessage = { role: 'assistant', text: '' };
        let currentText = '';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: input, 
                    history: messages.map(m => ({
                        role: m.role === 'user' ? 'user' : 'model',
                        parts: [{ text: m.text }]
                    }))
                }),
            });

            if (!response.body) {
                throw new Error("Response body is null");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        try {
                            const json = JSON.parse(line.substring(5));
                            if (json.type === 'chunk' && json.text) {
                                currentText += json.text;
                                setMessages(prev => {
                                    const lastMsg = prev[prev.length - 1];
                                    if (lastMsg.role === 'assistant') {
                                        return [...prev.slice(0, -1), { ...lastMsg, text: currentText }];
                                    }
                                    return [...prev, { role: 'assistant', text: currentText }];
                                });
                            } else if (json.type === 'error') {
                                console.error("Stream error:", json.message);
                                setMessages(prev => {
                                    const lastMsg = prev[prev.length - 1];
                                    if (lastMsg.role === 'assistant') {
                                        // If the last message was the placeholder, replace it
                                        return [...prev.slice(0, -1), { role: 'assistant', text: `Error: ${json.message}` }];
                                    }
                                    // Otherwise, add a new error message
                                    return [...prev, { role: 'assistant', text: `Error: ${json.message}` }];
                                });
                                setIsLoading(false);
                            } else if (json.type === 'done') {
                                setIsLoading(false);
                            }
                        } catch (e) {
                            // Ignore parsing errors for incomplete JSON
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Fetch error:", error);
            setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I encountered an error." }]);
            setIsLoading(false);
        }
    };

    return (
        <div id="container">
            <main id="main-content">
                <section id="chat-section">
                    <div id="chat-log" ref={chatLogRef}>
                        {messages.map((msg, index) => (
                            <div key={index} className={`chat-message ${msg.role}`}>
                                <div className="message-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="chat-message assistant">
                                <div className="message-content">
                                    <div className="loading-indicator">
                                        <span></span><span></span><span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <form id="chat-form" onSubmit={sendMessage}>
                        <textarea
                            id="chat-input"
                            placeholder="Type your message..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage(e);
                                }
                            }}
                        ></textarea>
                        <button type="submit" id="send-button">Send</button>
                    </form>
                </section>
            </main>
        </div>
    );
}
