'use client';

import { useCallback, useEffect, useState } from 'react';
import chatDB from '../../lib/database';
import { CUSTOM_PROMPT_PREFIX } from '../../lib/constants';

export const customPromptKey = (id) => `${CUSTOM_PROMPT_PREFIX}${id}`;
export const isCustomPromptKey = (key) => typeof key === 'string' && key.startsWith(CUSTOM_PROMPT_PREFIX);
export const customPromptIdFromKey = (key) => isCustomPromptKey(key) ? Number(key.slice(CUSTOM_PROMPT_PREFIX.length)) : null;

const LEGACY_STORAGE_KEY = 'customPrompt';
const LEGACY_SELECTION = 'Custom Prompt';

/**
 * useCustomPrompts — CRUD over user-authored system prompts in IndexedDB.
 * On first load, migrates the legacy single localStorage prompt into the table.
 *
 * @returns {{
 *   customPrompts: Array<{id:number,name:string,content:string,created:Date,updated:Date}>,
 *   loaded: boolean,
 *   migratedKey: string|null,   // key to select if the legacy 'Custom Prompt' selection was in use
 *   createPrompt: (name?:string, content?:string) => Promise<string>,  // returns selection key
 *   updatePrompt: (id:number, changes:{name?:string,content?:string}) => Promise<void>,
 *   deletePrompt: (id:number) => Promise<void>,
 *   getPrompt: (key:string) => object|undefined,
 * }}
 */
export function useCustomPrompts() {
    const [customPrompts, setCustomPrompts] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [migratedKey, setMigratedKey] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                let rows = await chatDB.getAllCustomPrompts();
                const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
                if (legacy && legacy.trim()) {
                    const id = await chatDB.createCustomPrompt('My Custom Prompt', legacy);
                    localStorage.removeItem(LEGACY_STORAGE_KEY);
                    rows = await chatDB.getAllCustomPrompts();
                    if (!cancelled) setMigratedKey(customPromptKey(id));
                } else if (localStorage.getItem('selectedSystemPrompt') === LEGACY_SELECTION && rows.length) {
                    if (!cancelled) setMigratedKey(customPromptKey(rows[0].id));
                }
                if (!cancelled) setCustomPrompts(rows);
            } catch (err) {
                console.error('Failed to load custom prompts:', err);
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const createPrompt = useCallback(async (name, content = '') => {
        const id = await chatDB.createCustomPrompt(name, content);
        setCustomPrompts(await chatDB.getAllCustomPrompts());
        return customPromptKey(id);
    }, []);

    const updatePrompt = useCallback(async (id, changes) => {
        // Optimistic local update so typing in the editor stays responsive.
        setCustomPrompts(prev => prev.map(p => p.id === id ? { ...p, ...changes, updated: new Date() } : p));
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
        const id = customPromptIdFromKey(key);
        return id == null ? undefined : customPrompts.find(p => p.id === id);
    }, [customPrompts]);

    return { customPrompts, loaded, migratedKey, createPrompt, updatePrompt, deletePrompt, getPrompt };
}
