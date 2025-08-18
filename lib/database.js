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
    async addMessage(chatId, role, content) {
        const messageCount = await this.messages.where('chatId').equals(chatId).count();
        const messageId = await this.messages.add({
            chatId,
            role,
            content,
            timestamp: new Date(),
            messageIndex: messageCount
        });

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
            if (existingChats.length > 0) {
                console.log('IndexedDB already has data, skipping migration');
                return { migrated: false, reason: 'already_exists' };
            }

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
        // Clear all chats and messages
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
