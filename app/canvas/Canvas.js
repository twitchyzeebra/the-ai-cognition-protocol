'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import './canvas.css';
import useCanvas from './useCanvas';
import CanvasNodeCard from './CanvasNodeCard';
import AddNodeModal from './AddNodeModal';
import NodeModal from './NodeModal';
import chatDB from '../../lib/database';

export default function Canvas() {
    const {
        nodes,
        viewport,
        selectedNode,
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
    } = useCanvas();

    const fileInputRef = useRef(null);

    const [isPanning, setIsPanning] = useState(false);
    const [nextNodePosition, setNextNodePosition] = useState(null);
    const viewportRef = useRef(null);
    const dragStartRef = useRef(null);

    // Canvas panning
    const handleViewportPointerDown = useCallback((e) => {
        // Only pan if clicking on the viewport background, not on a node
        if (e.target !== viewportRef.current) return;

        setIsPanning(true);
        viewportRef.current.setPointerCapture(e.pointerId);
        dragStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startViewportX: viewport.x,
            startViewportY: viewport.y
        };
        deselectNode();
    }, [viewport.x, viewport.y, deselectNode]);

    const handleViewportPointerMove = useCallback((e) => {
        if (!isPanning || !dragStartRef.current) return;

        const deltaX = e.clientX - dragStartRef.current.startX;
        const deltaY = e.clientY - dragStartRef.current.startY;
        const newX = dragStartRef.current.startViewportX + deltaX;
        const newY = dragStartRef.current.startViewportY + deltaY;
        saveViewport(newX, newY);
    }, [isPanning, saveViewport]);

    const handleViewportPointerUp = useCallback((e) => {
        if (!isPanning) return;
        viewportRef.current?.releasePointerCapture(e.pointerId);
        setIsPanning(false);
        dragStartRef.current = null;
    }, [isPanning]);

    // Node selection
    const handleNodeSelect = useCallback((nodeId) => {
        selectNode(nodeId);
    }, [selectNode]);

    // Node position changes (during drag)
    const handleNodePositionChange = useCallback((nodeId, { x, y }) => {
        updateNodePosition(nodeId, { x, y });
    }, [updateNodePosition]);

    // Node position save (after drag)
    const handleNodePositionSave = useCallback((nodeId, { x, y }) => {
        saveNodePosition(nodeId, { x, y });
    }, [saveNodePosition]);

    // Create new node
    const handleCreateNode = useCallback(async ({ type, title, x, y, content, imageUrl }) => {
        let chatId = null;

        // For chat nodes, create a new chat in the database
        if (type === 'chat') {
            const llmSettings = {};
            try {
                const storedPageState = localStorage.getItem('pageState');
                if (storedPageState) {
                    const parsed = JSON.parse(storedPageState);
                    Object.assign(llmSettings, parsed.llmSettings || {});
                }
            } catch {}

            chatId = await chatDB.createChat(
                title,
                'system-prompt',
                llmSettings.provider || 'google',
                llmSettings.models?.[llmSettings.provider] || ''
            );
            await createNode({ type, title, chatId, x, y });
        } else {
            await createNode({ type, title, content, imageUrl, x, y });
        }
    }, [createNode]);

    // Update node
    const handleUpdateNode = useCallback(async (nodeId, changes) => {
        await updateNode(nodeId, changes);
    }, [updateNode]);

    // Delete node
    const handleDeleteNode = useCallback(async (nodeId) => {
        await deleteNode(nodeId);
        deselectNode();
    }, [deleteNode, deselectNode]);

    // Download canvas
    const handleDownload = useCallback(() => {
        exportCanvas();
    }, [exportCanvas]);

    // Upload canvas
    const handleFileSelect = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        importCanvas(file).then(result => {
            alert(`Imported ${result.nodeCount} nodes successfully.`);
        }).catch(err => {
            alert(`Import failed: ${err.message}`);
        });
        e.target.value = '';
    }, [importCanvas]);

    // Track mouse position for default node placement
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isAddModalOpen) {
                const rect = viewportRef.current?.getBoundingClientRect();
                if (rect) {
                    setNextNodePosition({
                        x: e.clientX - rect.left - viewport.x,
                        y: e.clientY - rect.top - viewport.y
                    });
                }
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isAddModalOpen, viewport.x, viewport.y]);

    if (!isLoaded) {
        return (
            <div id="canvas-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ opacity: 0.6 }}>Loading canvas...</div>
            </div>
        );
    }

    return (
        <div id="canvas-app">
            {/* Canvas toolbar */}
            <div
                style={{
                    position: 'fixed',
                    top: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    zIndex: 200,
                    background: 'var(--container-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '6px 10px'
                }}
            >
                <a
                    href="/"
                    style={{
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: 'var(--text-color)',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        padding: '6px 12px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    ← Home
                </a>
                <button
                    onClick={handleDownload}
                    title="Download canvas"
                    style={{
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: 'var(--text-color)',
                        cursor: 'pointer',
                        padding: '6px 12px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    ⬇ Export
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload canvas"
                    style={{
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: 'var(--text-color)',
                        cursor: 'pointer',
                        padding: '6px 12px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    ⬆ Import
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />
            </div>

            {/* Pannable viewport */}
            <div
                ref={viewportRef}
                id="canvas-viewport"
                onPointerDown={handleViewportPointerDown}
                onPointerMove={handleViewportPointerMove}
                onPointerUp={handleViewportPointerUp}
                style={{
                    transform: `translate(${viewport.x}px, ${viewport.y}px)`,
                    cursor: isPanning ? 'grabbing' : 'grab'
                }}
            >
                {/* Render nodes */}
                {nodes.map(node => (
                    <CanvasNodeCard
                        key={node.id}
                        node={node}
                        onSelect={handleNodeSelect}
                        onPositionChange={handleNodePositionChange}
                        onPositionSave={handleNodePositionSave}
                    />
                ))}
            </div>

            {/* Empty state hint */}
            {nodes.length === 0 && (
                <div
                    style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        opacity: 0.4,
                        pointerEvents: 'none'
                    }}
                >
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
                    <div style={{ fontSize: '16px' }}>
                        Click the + button to add your first node
                    </div>
                </div>
            )}

            {/* Add node button */}
            <button id="add-node-btn" onClick={openAddModal} title="Add Node">
                +
            </button>

            {/* Add node modal */}
            <AddNodeModal
                isOpen={isAddModalOpen}
                onClose={closeAddModal}
                onCreate={handleCreateNode}
                defaultPosition={nextNodePosition}
            />

            {/* Node detail modal */}
            {selectedNode && (
                <NodeModal
                    node={selectedNode}
                    onClose={deselectNode}
                    onUpdate={handleUpdateNode}
                    onDelete={handleDeleteNode}
                />
            )}
        </div>
    );
}
