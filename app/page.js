'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Sidebar from './components/Sidebar';
import './components/Sidebar.css';
import './globals.css';

export default function Home() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [learningResources, setLearningResources] = useState([]);
    const [selectedResource, setSelectedResource] = useState(null);
    const [resourceContent, setResourceContent] = useState('');
    const [isChatCollapsed, setIsChatCollapsed] = useState(false);
    const [isResourceCollapsed, setIsResourceCollapsed] = useState(false);
    const chatLogRef = useRef(null);

    // Load chat history from localStorage on initial render
    useEffect(() => {
        const storedHistory = localStorage.getItem('chatHistory');
        if (storedHistory) {
            setChatHistory(JSON.parse(storedHistory));
        }
        fetchLearningResources();
    }, []);

    // Save chat history to localStorage whenever it changes
    useEffect(() => {
        if (chatHistory.length > 0) {
            localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        }
    }, [chatHistory]);

    useEffect(() => {
        // Auto-scroll to the bottom of the chat log
        if (chatLogRef.current) {
            chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchLearningResources = async () => {
        try {
            const response = await fetch('/api/learning-resources');
            const data = await response.json();
            setLearningResources(data);
        } catch (error) {
            console.error('Failed to fetch learning resources:', error);
        }
    };

    const handleSelectResource = async (slug) => {
        if (slug === selectedResource) {
            // If the currently selected resource is clicked again, toggle collapse state.
            setIsResourceCollapsed(prev => !prev);
        } else {
            try {
                const response = await fetch(`/api/learning-resources/${slug}`);
                const data = await response.json();
                setSelectedResource(slug);
                setResourceContent(data.content);
                setIsResourceCollapsed(false); // Ensure resource is visible
            } catch (error) {
                console.error(`Failed to fetch resource ${slug}:`, error);
            }
        }
    };

    const handleNewChat = () => {
        setActiveChatId(null);
        setMessages([]);
        setSelectedResource(null);
        setResourceContent('');
    };

    const handleSelectChat = (id) => {
        if (id === activeChatId) {
            // If the currently active chat is clicked again, toggle collapse state.
            setIsChatCollapsed(prev => !prev);
        } else {
            // Otherwise, select the new chat and make sure it's visible.
            const chat = chatHistory.find(c => c.id === id);
            if (chat) {
                setActiveChatId(id);
                setMessages(chat.messages);
                setSelectedResource(null); // Deselect any resource
                setResourceContent('');
                setIsChatCollapsed(false); // Ensure chat is visible
            }
        }
    };

    const handleDeleteChat = (id) => {
        setChatHistory(prev => prev.filter(chat => chat.id !== id));
        if (activeChatId === id) {
            setActiveChatId(null);
            setMessages([]);
        }
    };

    const handleDownload = () => {
        if (!activeChatId) {
            // If no chat is active, download the entire history
            if (chatHistory.length === 0) {
                alert("No chat history to download.");
                return;
            }
            const blob = new Blob([JSON.stringify(chatHistory, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `all-chat-history.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            // If a chat is active, download only that chat
            const activeChat = chatHistory.find(chat => chat.id === activeChatId);
            if (activeChat) {
                const blob = new Blob([JSON.stringify(activeChat, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chat-history-${activeChat.title.replace(/\s+/g, '_')}-${activeChat.id}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        }
    };

    const handleUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const uploadedHistory = JSON.parse(e.target.result);
                // Basic validation to see if it's a single chat or all history
                if (Array.isArray(uploadedHistory) && uploadedHistory.every(c => c.id && c.title && c.messages)) {
                    // It's likely an array of chats (all history)
                    setChatHistory(prev => {
                        const existingIds = new Set(prev.map(c => c.id));
                        const newChats = uploadedHistory.filter(c => !existingIds.has(c.id));
                        return [...prev, ...newChats];
                    });
                } else if (uploadedHistory.id && uploadedHistory.title && uploadedHistory.messages) {
                    // It's likely a single chat object
                    setChatHistory(prev => {
                        // Avoid duplicates
                        if (prev.some(c => c.id === uploadedHistory.id)) {
                            return prev;
                        }
                        return [...prev, uploadedHistory];
                    });
                } else {
                    alert("Invalid chat history file format.");
                }
            } catch (error) {
                console.error("Error parsing uploaded file:", error);
                alert("Failed to upload history. The file might be corrupted or in the wrong format.");
            }
        };
        reader.readAsText(file);
        // Reset file input so the same file can be uploaded again
        event.target.value = null;
    };

    const handleSendMessage = async () => {
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        let currentChatId = activeChatId;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: input,
                    history: messages.map(m => ({
                        role: m.role === 'user' ? 'user' : 'model',
                        parts: [{ text: m.content }]
                    }))
                }),
            });

            if (!response.body) {
                throw new Error("Response body is null");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponseText = '';
            
            // Add a placeholder for the AI response
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        try {
                            const json = JSON.parse(line.substring(5));
                            if (json.type === 'chunk' && json.text) {
                                aiResponseText += json.text;
                                setMessages(prev => {
                                    const lastMsgIndex = prev.length - 1;
                                    const updatedMessages = [...prev];
                                    updatedMessages[lastMsgIndex] = { ...updatedMessages[lastMsgIndex], content: aiResponseText };
                                    return updatedMessages;
                                });
                            } else if (json.type === 'error') {
                                throw new Error(json.message);
                            }
                        } catch (e) {
                            // Ignore incomplete JSON
                        }
                    }
                }
            }
            
            const finalMessages = [...newMessages, { role: 'assistant', content: aiResponseText }];
            
            if (currentChatId) {
                // Update existing chat
                setChatHistory(prev => prev.map(chat =>
                    chat.id === currentChatId ? { ...chat, messages: finalMessages } : chat
                ));
            } else {
                // Create a new chat
                const newId = Date.now().toString();
                const newTitle = input.substring(0, 30);
                const newChat = { id: newId, title: newTitle, messages: finalMessages };
                setChatHistory(prev => [...prev, newChat]);
                setActiveChatId(newId);
            }

        } catch (error) {
            console.error("API error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div id="container">
            <Sidebar 
                history={chatHistory} 
                onNewChat={handleNewChat} 
                onSelectChat={handleSelectChat}
                activeChatId={activeChatId}
                onDownload={handleDownload}
                onUpload={handleUpload}
                learningResources={learningResources}
                onSelectResource={handleSelectResource}
                onDeleteChat={handleDeleteChat}
            />
            <main id="main-content">
                {!isChatCollapsed && (
                    <div id="chat-column">
                        <div id="chat-log" ref={chatLogRef}>
                            {messages.map((msg, index) => (
                                <div key={index} className={`message ${msg.role}`}>
                                    <div className="content">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="message assistant">
                                    <div className="loader"></div>
                                </div>
                            )}
                        </div>
                        <div id="chat-input">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder="Type your message..."
                                disabled={isLoading}
                            />
                            <button onClick={handleSendMessage} disabled={isLoading}>
                                {isLoading ? 'Thinking...' : 'Send'}
                            </button>
                        </div>
                    </div>
                )}
                
                {selectedResource && !isResourceCollapsed && (
                    <div id="resource-column">
                        <div className="prose lg:prose-xl p-4">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{resourceContent}</ReactMarkdown>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
