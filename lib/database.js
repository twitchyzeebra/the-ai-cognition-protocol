import Dexie from 'dexie';

// IndexedDB Database for Chat Management
class ChatDatabase extends Dexie {
    constructor() {
        super('AICognitionProtocol');
        
        // Define database schema
        this.version(1).stores({
            chats: '++id, title, created, updated, systemPrompt, provider, model',
            messages: '++id, chatId, role, content, timestamp, messageIndex'
        });

        this.version(2).stores({
            chats: '++id, title, created, updated, systemPrompt, provider, model',
            messages: '++id, chatId, role, content, timestamp, messageIndex',
            canvas: 'id',
            canvasNodes: '++id, type, title, created, updated'
        });

        // v3: user-authored system prompts (replaces the single localStorage 'customPrompt')
        this.version(3).stores({
            chats: '++id, title, created, updated, systemPrompt, provider, model',
            messages: '++id, chatId, role, content, timestamp, messageIndex',
            canvas: 'id',
            canvasNodes: '++id, type, title, created, updated',
            customPrompts: '++id, name, created, updated'
        });
    }

    // Custom system prompt operations
    async getAllCustomPrompts() {
        return await this.customPrompts.orderBy('created').toArray();
    }

    async createCustomPrompt(name, content = '') {
        const now = new Date();
        return await this.customPrompts.add({
            name: (name || '').trim() || 'Untitled Prompt',
            content: content || '',
            created: now,
            updated: now
        });
    }

    async updateCustomPrompt(id, changes) {
        await this.customPrompts.update(id, { ...changes, updated: new Date() });
    }

    async deleteCustomPrompt(id) {
        await this.customPrompts.delete(id);
    }

    // Canvas viewport operations
    async getCanvas() {
        const record = await this.canvas.get(1);
        return record || { id: 1, x: 0, y: 0 };
    }

    async saveCanvasViewport(x, y) {
        await this.canvas.put({ id: 1, x, y });
    }

    // Canvas node operations
    async createCanvasNode({ type, title, content, chatId, imageUrl, x, y }) {
        const now = new Date();
        const nodeId = await this.canvasNodes.add({
            type,
            title: title || 'Untitled',
            content: content || null,
            chatId: chatId || null,
            imageUrl: imageUrl || null,
            x: x ?? 100,
            y: y ?? 100,
            width: 240,
            height: 160,
            created: now,
            updated: now
        });
        return nodeId;
    }

    async updateCanvasNode(nodeId, changes) {
        await this.canvasNodes.update(nodeId, {
            ...changes,
            updated: new Date()
        });
    }

    async deleteCanvasNode(nodeId) {
        await this.canvasNodes.delete(nodeId);
    }

    async getAllCanvasNodes() {
        return await this.canvasNodes.toArray();
    }

    // Chat operations
    async createChat(title, systemPrompt, provider, model) {
        const now = new Date();
        const chatId = await this.chats.add({
            title: title || 'New Chat',
            created: now,
            updated: now,
            systemPrompt: systemPrompt || 'system-prompt',
            provider: provider || 'google',
            model: model || ''
        });
        return chatId;
    }

    async updateChatTitle(chatId, title) {
        await this.chats.update(chatId, { 
            title,
            updated: new Date()
        });
    }

    async deleteChat(chatId) {
        // Delete chat and all its messages
        await this.transaction('rw', this.chats, this.messages, async () => {
            await this.messages.where('chatId').equals(chatId).delete();
            await this.chats.delete(chatId);
        });
    }

    async getAllChats() {
        return await this.chats
            .orderBy('updated')
            .reverse()
            .toArray();
    }

    async getChat(chatId) {
        return await this.chats.get(chatId);
    }

    // Message operations
    async addMessage(chatId, role, content, meta) {
        const messageCount = await this.messages.where('chatId').equals(chatId).count();
        const record = {
            chatId,
            role,
            content,
            timestamp: new Date(),
            messageIndex: messageCount
        };
        // Persist optional display metadata (displayContent, files, etc.)
        if (meta) Object.assign(record, meta);
        const messageId = await this.messages.add(record);

        // Update chat's last updated time
        await this.chats.update(chatId, { updated: new Date() });
        
        return messageId;
    }

    async getChatMessages(chatId) {
        return await this.messages
            .where('chatId')
            .equals(chatId)
            .sortBy('messageIndex');
    }

    async updateMessage(messageId, content) {
        await this.messages.update(messageId, { content });
    }

    async deleteMessage(messageId) {
        await this.messages.delete(messageId);
    }

    // Migration from localStorage
    async migrateFromLocalStorage() {
        try {
            // Check if we already have data
            const existingChats = await this.getAllChats();
            

            // Try to get data from localStorage
            const storedPageState = localStorage.getItem('pageState');
            const storedChatHistory = localStorage.getItem('chatHistory');
            
            let chatHistory = [];
            
            // Parse stored data
            if (storedPageState) {
                try {
                    const pageState = JSON.parse(storedPageState);
                    if (pageState.chatHistory) {
                        chatHistory = pageState.chatHistory;
                    }
                } catch (e) {
                    console.log('Could not parse pageState, trying chatHistory');
                }
            }
            
            if (chatHistory.length === 0 && storedChatHistory) {
                try {
                    chatHistory = JSON.parse(storedChatHistory);
                } catch (e) {
                    console.log('Could not parse chatHistory');
                }
            }

            if (chatHistory.length === 0) {
                console.log('No localStorage data to migrate');
                return { migrated: false, reason: 'no_data' };
            }
            if (existingChats.length > 0 &&  existingChats.length === chatHistory.length) {
                console.log('IndexedDB already has data, skipping migration');
                return { migrated: false, reason: 'already_exists' };
            }

            // Migrate each chat
            let migratedCount = 0;
            for (const chat of chatHistory) {
                try {
                    const chatId = await this.createChat(
                        chat.title || `Chat ${migratedCount + 1}`,
                        'Core OS v1.1', // Default system prompt
                        'google', // Default provider
                        '' // Default model
                    );

                    // Migrate messages
                    if (chat.messages && Array.isArray(chat.messages)) {
                        for (const message of chat.messages) {
                            await this.addMessage(
                                chatId,
                                message.role || 'user',
                                message.content || ''
                            );
                        }
                    }
                    migratedCount++;
                } catch (error) {
                    console.error('Error migrating chat:', error);
                }
            }

            console.log(`Successfully migrated ${migratedCount} chats to IndexedDB`);
            return { migrated: true, count: migratedCount };

        } catch (error) {
            console.error('Migration error:', error);
            return { migrated: false, reason: 'error', error };
        }
    }

    // Cleanup and maintenance
    async clearAllData() {
        // Clear all chats and messages (custom prompts and canvas are kept)
        await this.messages.clear();
        await this.chats.clear();
        console.log('All chat data cleared from IndexedDB');
    }

    // Export data for backup
    async exportData() {
        const chats = await this.getAllChats();
        const exportData = [];

        for (const chat of chats) {
            const messages = await this.getChatMessages(chat.id);
            exportData.push({
                ...chat,
                messages
            });
        }

        return exportData;
    }
}

// Create singleton instance
const chatDB = new ChatDatabase();

export default chatDB;
