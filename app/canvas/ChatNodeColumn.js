'use client';

import { useEffect, useRef } from 'react';
import ChatColumn from '../components/ChatColumn';
import useChat from '../hooks/useChat';

export default function ChatNodeColumn({ chatId, systemPrompt, llmSettings, onDelete }) {
    const chat = useChat({ selectedSystemPrompt: systemPrompt || 'system-prompt', customPrompt: '', llmSettings: llmSettings || {} });
    const initializedRef = useRef(false);

    // Once chatId is available, load it
    useEffect(() => {
        if (!chatId || initializedRef.current) return;
        initializedRef.current = true;
        chat.setActiveChatId(chatId);
    }, [chatId]);

    const handleCollapse = () => {
        // Nothing to collapse in modal context — handled by parent
    };

    return (
        <ChatColumn
            chat={chat}
            onCollapse={handleCollapse}
            onDelete={onDelete}
        />
    );
}
