'use client';

import { useCallback, useEffect, useState } from 'react';
import chatDB from '../../lib/database';
import { customPromptKey, isCustomPromptKey, CUSTOM_PROMPT_PREFIX } from '../../lib/constants';

const LEGACY_STORAGE_KEY = 'customPrompt';

/**
 * useCustomPrompts — CRUD over user-authored system prompts in IndexedDB.
 * On first load, migrates the legacy single localStorage prompt into the table;
 * `migratedKey` is then its selection key (to replace a legacy 'Custom Prompt' selection).
 */
export function useCustomPrompts() {
    const [customPrompts, setCustomPrompts] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [migratedKey, setMigratedKey] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
                if (legacy?.trim()) {
                    const id = await chatDB.createCustomPrompt('My Custom Prompt', legacy);
                    localStorage.removeItem(LEGACY_STORAGE_KEY);
                    if (!cancelled) setMigratedKey(customPromptKey(id));
                }
                const rows = await chatDB.getAllCustomPrompts();
                if (!cancelled) setCustomPrompts(rows);
            } catch (err) {
                console.error('Failed to load custom prompts:', err);
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    /** Returns the new prompt's selection key. */
    const createPrompt = useCallback(async (name, content = '') => {
        const id = await chatDB.createCustomPrompt(name, content);
        setCustomPrompts(await chatDB.getAllCustomPrompts());
        return customPromptKey(id);
    }, []);

    const updatePrompt = useCallback(async (id, changes) => {
        // Optimistic local update so typing in the editor stays responsive.
        setCustomPrompts(prev => prev.map(p => (p.id === id ? { ...p, ...changes, updated: new Date() } : p)));
        try {
            await chatDB.updateCustomPrompt(id, changes);
        } catch (err) {
            console.error('Failed to save custom prompt:', err);
        }
    }, []);

    const deletePrompt = useCallback(async (id) => {
        await chatDB.deleteCustomPrompt(id);
        setCustomPrompts(prev => prev.filter(p => p.id !== id));
    }, []);

    const getPrompt = useCallback((key) => {
        if (!isCustomPromptKey(key)) return undefined;
        const id = Number(key.slice(CUSTOM_PROMPT_PREFIX.length));
        return customPrompts.find(p => p.id === id);
    }, [customPrompts]);

    return { customPrompts, loaded, migratedKey, createPrompt, updatePrompt, deletePrompt, getPrompt };
}
