'use client';

import { useState, useEffect, useCallback } from 'react';
import chatDB from '../../lib/database';

export default function useCanvas() {
    const [nodes, setNodes] = useState([]);
    const [viewport, setViewport] = useState({ x: 0, y: 0 });
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load canvas state on mount
    useEffect(() => {
        const loadCanvas = async () => {
            try {
                const [canvasRecord, allNodes] = await Promise.all([
                    chatDB.getCanvas(),
                    chatDB.getAllCanvasNodes()
                ]);
                setViewport({ x: canvasRecord.x, y: canvasRecord.y });
                setNodes(allNodes);
            } catch (error) {
                console.error('Failed to load canvas:', error);
            } finally {
                setIsLoaded(true);
            }
        };
        loadCanvas();
    }, []);

    // Save viewport to IndexedDB
    const saveViewport = useCallback(async (x, y) => {
        setViewport({ x, y });
        try {
            await chatDB.saveCanvasViewport(x, y);
        } catch (error) {
            console.error('Failed to save viewport:', error);
        }
    }, []);

    // Create a new node
    const createNode = useCallback(async ({ type, title, content, chatId, imageUrl, x, y }) => {
        try {
            const nodeId = await chatDB.createCanvasNode({ type, title, content, chatId, imageUrl, x, y });
            const newNode = await chatDB.canvasNodes.get(nodeId);
            setNodes(prev => [...prev, newNode]);
            return nodeId;
        } catch (error) {
            console.error('Failed to create node:', error);
            throw error;
        }
    }, []);

    // Update node position (during drag)
    const updateNodePosition = useCallback(async (nodeId, { x, y }) => {
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x, y } : n));
    }, []);

    // Save node position to IndexedDB (on drag end)
    const saveNodePosition = useCallback(async (nodeId, { x, y }) => {
        try {
            await chatDB.updateCanvasNode(nodeId, { x, y });
        } catch (error) {
            console.error('Failed to save node position:', error);
        }
    }, []);

    // Update node content/title
    const updateNode = useCallback(async (nodeId, changes) => {
        try {
            await chatDB.updateCanvasNode(nodeId, changes);
            setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...changes } : n));
        } catch (error) {
            console.error('Failed to update node:', error);
        }
    }, []);

    // Delete node
    const deleteNode = useCallback(async (nodeId) => {
        try {
            await chatDB.deleteCanvasNode(nodeId);
            setNodes(prev => prev.filter(n => n.id !== nodeId));
            if (selectedNodeId === nodeId) {
                setSelectedNodeId(null);
            }
        } catch (error) {
            console.error('Failed to delete node:', error);
        }
    }, [selectedNodeId]);

    // Select/deselect node
    const selectNode = useCallback((nodeId) => {
        setSelectedNodeId(nodeId);
    }, []);

    const deselectNode = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    // Open/close add modal
    const openAddModal = useCallback(() => setIsAddModalOpen(true), []);
    const closeAddModal = useCallback(() => setIsAddModalOpen(false), []);

    // Get selected node
    const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

    // Export canvas to JSON
    const exportCanvas = useCallback(async () => {
        const exportData = {
            version: 1,
            viewport,
            nodes: [],
            exportedAt: new Date().toISOString()
        };

        for (const node of nodes) {
            const nodeData = { ...node };
            // For chat nodes, include messages
            if (node.type === 'chat' && node.chatId) {
                const messages = await chatDB.getChatMessages(node.chatId);
                nodeData.messages = messages;
            }
            exportData.nodes.push(nodeData);
        }

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `canvas-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [nodes, viewport]);

    // Import canvas from JSON
    const importCanvas = useCallback(async (file) => {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.version || !Array.isArray(data.nodes)) {
                throw new Error('Invalid canvas export file');
            }

            const nodeIdMap = {}; // old ID -> new ID

            // Read current LLM settings from localStorage for imported chats
            let importLlmSettings = {};
            try {
                const stored = localStorage.getItem('pageState');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    importLlmSettings = parsed.llmSettings || {};
                }
            } catch {}

            for (const nodeData of data.nodes) {
                const { id, messages, ...nodeFields } = nodeData;
                let newChatId = null;

                // For chat nodes, recreate the chat with messages
                if (nodeFields.type === 'chat' && Array.isArray(messages) && messages.length > 0) {
                    const chatTitle = nodeFields.title || 'Imported Chat';
                    const provider = importLlmSettings.provider || 'google';
                    const model = (importLlmSettings.models || {})[provider] || '';
                    newChatId = await chatDB.createChat(
                        chatTitle,
                        'system-prompt',
                        provider,
                        model
                    );
                    for (const msg of messages) {
                        await chatDB.addMessage(newChatId, msg.role, msg.content);
                    }
                }

                const nodeId = await chatDB.createCanvasNode({
                    ...nodeFields,
                    chatId: newChatId || nodeFields.chatId || null
                });
                nodeIdMap[id] = nodeId;
            }

            // Restore viewport
            if (data.viewport) {
                await chatDB.saveCanvasViewport(data.viewport.x || 0, data.viewport.y || 0);
                setViewport({ x: data.viewport.x || 0, y: data.viewport.y || 0 });
            }

            // Reload nodes
            const allNodes = await chatDB.getAllCanvasNodes();
            setNodes(allNodes);

            return { success: true, nodeCount: data.nodes.length };
        } catch (error) {
            console.error('Failed to import canvas:', error);
            throw error;
        }
    }, []);

    return {
        nodes,
        viewport,
        selectedNode,
        selectedNodeId,
        isAddModalOpen,
        isLoaded,
        saveViewport,
        createNode,
        updateNodePosition,
        saveNodePosition,
        updateNode,
        deleteNode,
        selectNode,
        deselectNode,
        openAddModal,
        closeAddModal,
        exportCanvas,
        importCanvas
    };
}
