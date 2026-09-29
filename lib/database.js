import Dexie from 'dexie';

// IndexedDB storage for chats, messages and user-authored system prompts.
class ChatDatabase extends Dexie {
    constructor() {
        super('AICognitionProtocol');
        this.version(1).stores({
            chats: '++id, title, created, updated, systemPrompt, provider, model',
            messages: '++id, chatId, role, content, timestamp, messageIndex'
        });
        // v3: user-authored system prompts (replaces the single localStorage 'customPrompt')
        this.version(3).stores({
            chats: '++id, title, created, updated, systemPrompt, provider, model',
            messages: '++id, chatId, role, content, timestamp, messageIndex',
            customPrompts: '++id, name, created, updated'
        });
    }

    getAllCustomPrompts() {
        return this.customPrompts.orderBy('created').toArray();
    }

    createCustomPrompt(name, content = '') {
        const now = new Date();
        return this.customPrompts.add({ name: (name || '').trim() || 'Untitled Prompt', content: content || '', created: now, updated: now });
    }

    updateCustomPrompt(id, changes) {
        return this.customPrompts.update(id, { ...changes, updated: new Date() });
    }

    deleteCustomPrompt(id) {
        return this.customPrompts.delete(id);
    }

    getAllChats() {
        return this.chats.orderBy('updated').reverse().toArray();
    }

    getChatMessages(chatId) {
        return this.messages.where('chatId').equals(chatId).sortBy('messageIndex');
    }

    /** Creates a chat, with optional initial [{ role, content }] messages, in one transaction. */
    createChat(title, systemPrompt, provider, model, messages = []) {
        return this.transaction('rw', this.chats, this.messages, async () => {
            const now = new Date();
            const chatId = await this.chats.add({
                title: title || 'New Chat', created: now, updated: now,
                systemPrompt: systemPrompt || 'system-prompt', provider: provider || 'google', model: model || ''
            });
            await this.messages.bulkAdd(messages.map((m, messageIndex) => ({
                chatId, role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content || '', timestamp: now, messageIndex
            })));
            return chatId;
        });
    }

    updateChatTitle(chatId, title) {
        return this.chats.update(chatId, { title, updated: new Date() });
    }

    deleteChat(chatId) {
        return this.transaction('rw', this.chats, this.messages, async () => {
            await this.messages.where('chatId').equals(chatId).delete();
            await this.chats.delete(chatId);
        });
    }

    /** `meta` holds optional display fields (displayContent, files, images, model). */
    addMessage(chatId, role, content, meta) {
        return this.transaction('rw', this.chats, this.messages, async () => {
            const messageIndex = await this.messages.where('chatId').equals(chatId).count();
            const id = await this.messages.add({ chatId, role, content, timestamp: new Date(), messageIndex, ...meta });
            await this.chats.update(chatId, { updated: new Date() });
            return id;
        });
    }

    /** Clears chats and messages; custom prompts are kept. */
    clearAllData() {
        return this.transaction('rw', this.chats, this.messages, () => Promise.all([this.messages.clear(), this.chats.clear()]));
    }

    // Pre-IndexedDB versions stored chats, with embedded messages, in localStorage. Later versions mirrored
    // metadata-only lists under the same key; those must not be imported (they resurrected deleted chats).
    async migrateFromLocalStorage() {
        const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
        const pageState = read('pageState');
        const legacy = [pageState?.chatHistory, read('chatHistory')].find(list => Array.isArray(list) && list.length) || [];
        const chats = legacy.filter(c => Array.isArray(c?.messages));
        for (const [i, chat] of chats.entries()) {
            await this.createChat(chat.title || `Chat ${i + 1}`, 'Core OS v1.1', 'google', '', chat.messages);
        }
        if (pageState?.chatHistory) {
            delete pageState.chatHistory;
            localStorage.setItem('pageState', JSON.stringify(pageState));
        }
        localStorage.removeItem('chatHistory');
        if (chats.length) console.log(`Migrated ${chats.length} chats from localStorage to IndexedDB`);
    }
}

const chatDB = new ChatDatabase();
export default chatDB;
