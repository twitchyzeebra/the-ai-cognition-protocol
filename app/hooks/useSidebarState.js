'use client';

import { useEffect, useState } from 'react';

/**
 * Custom hook that manages all sidebar UI state with localStorage persistence.
 * Handles collapse state, section visibility, and responsive behavior.
 */
export function useSidebarState() {
    // UI state (with localStorage persistence)
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(true);
    const [isResourcesVisible, setIsResourcesVisible] = useState(false);
    const [isPromptsVisible, setIsPromptsVisible] = useState(false);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isSmall, setIsSmall] = useState(false);

    // Load persisted UI state on mount
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('sidebarState') || '{}');
            if (typeof saved.isCollapsed === 'boolean') setIsCollapsed(saved.isCollapsed);
            if (typeof saved.isHistoryVisible === 'boolean') setIsHistoryVisible(saved.isHistoryVisible);
            if (typeof saved.isResourcesVisible === 'boolean') setIsResourcesVisible(saved.isResourcesVisible);
            if (typeof saved.isPromptsVisible === 'boolean') setIsPromptsVisible(saved.isPromptsVisible);
            if (typeof saved.isSettingsVisible === 'boolean') setIsSettingsVisible(saved.isSettingsVisible);

            // Default to collapsed on small screens if no saved preference
            if (typeof saved.isCollapsed !== 'boolean') {
                try {
                    if (typeof window !== 'undefined' && window.innerWidth < 900) {
                        setIsCollapsed(true);
                    }
                } catch {}
            }
        } catch {}
    }, []);

    // Track small-screen state for responsive rendering
    useEffect(() => {
        try {
            const update = () => {
                if (typeof window !== 'undefined') {
                    setIsSmall(window.innerWidth < 900);
                }
            };
            update();
            if (typeof window !== 'undefined') {
                window.addEventListener('resize', update);
                return () => window.removeEventListener('resize', update);
            }
        } catch {}
    }, []);

    // Persist UI state whenever it changes
    useEffect(() => {
        const payload = {
            isCollapsed,
            isHistoryVisible,
            isResourcesVisible,
            isPromptsVisible,
            isSettingsVisible,
        };
        try { localStorage.setItem('sidebarState', JSON.stringify(payload)); } catch {}
    }, [isCollapsed, isHistoryVisible, isResourcesVisible, isPromptsVisible, isSettingsVisible]);

    // Lock background scroll when the mobile drawer is open
    useEffect(() => {
        try {
            if (typeof window === 'undefined') return;
            const isSmallScreen = window.innerWidth < 900;
            if (isSmallScreen && !isCollapsed) {
                const prev = document.body.style.overflow;
                document.body.setAttribute('data-prev-overflow', prev || '');
                document.body.style.overflow = 'hidden';
            } else {
                const prev = document.body.getAttribute('data-prev-overflow') || '';
                document.body.style.overflow = prev;
                document.body.removeAttribute('data-prev-overflow');
            }
        } catch {}
        return () => {
            try {
                const prev = document.body.getAttribute('data-prev-overflow') || '';
                document.body.style.overflow = prev;
                document.body.removeAttribute('data-prev-overflow');
            } catch {}
        };
    }, [isCollapsed]);

    const toggleSidebar = () => setIsCollapsed(prev => !prev);
    const collapseSidebar = () => setIsCollapsed(true);
    const clearSidebarState = () => {
        try { localStorage.removeItem('sidebarState'); } catch {}
    };

    return {
        // State
        isCollapsed,
        isSmall,
        isHistoryVisible,
        isResourcesVisible,
        isPromptsVisible,
        isSettingsVisible,

        // Section toggles
        setIsHistoryVisible,
        setIsResourcesVisible,
        setIsPromptsVisible,
        setIsSettingsVisible,

        // Sidebar controls
        toggleSidebar,
        collapseSidebar,
        clearSidebarState,
    };
}
