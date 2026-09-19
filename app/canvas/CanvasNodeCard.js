'use client';

import { useRef, useState, useCallback } from 'react';
import './canvas.css';

const TYPE_ICONS = {
    chat: '💬',
    document: '📄',
    image: '🖼️'
};

export default function CanvasNodeCard({ node, onSelect, onPositionChange, onPositionSave }) {
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef(null);
    const didDragRef = useRef(false);

    const handlePointerDown = useCallback((e, nodeId) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        didDragRef.current = false;

        dragRef.current = {
            nodeId,
            startX: e.clientX,
            startY: e.clientY,
            startNodeX: node.x,
            startNodeY: node.y
        };
    }, [node.x, node.y]);

    const handlePointerMove = useCallback((e) => {
        if (!dragRef.current || !isDragging) return;

        const deltaX = e.clientX - dragRef.current.startX;
        const deltaY = e.clientY - dragRef.current.startY;

        // Mark as dragged if moved more than 4px (avoids accidental drags + suppresses click)
        if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
            didDragRef.current = true;
        }

        const newX = dragRef.current.startNodeX + deltaX;
        const newY = dragRef.current.startNodeY + deltaY;

        onPositionChange(dragRef.current.nodeId, { x: newX, y: newY });
    }, [isDragging, onPositionChange]);

    const handlePointerUp = useCallback((e, nodeId) => {
        if (!dragRef.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        setIsDragging(false);

        const deltaX = e.clientX - dragRef.current.startX;
        const deltaY = e.clientY - dragRef.current.startY;
        const newX = dragRef.current.startNodeX + deltaX;
        const newY = dragRef.current.startNodeY + deltaY;

        onPositionSave(nodeId, { x: newX, y: newY });
        dragRef.current = null;
    }, [onPositionSave]);

    const handleClick = useCallback((e, nodeId) => {
        e.stopPropagation();
        // Only select if we didn't actually drag
        if (!didDragRef.current) {
            onSelect(nodeId);
        }
        didDragRef.current = false;
    }, [onSelect]);

    const getPreview = () => {
        if (node.type === 'chat') {
            return 'Click to open chat...';
        }
        if (node.type === 'document') {
            if (!node.content) return 'Empty document';
            return node.content.slice(0, 120) + (node.content.length > 120 ? '...' : '');
        }
        if (node.type === 'image') {
            if (node.imageUrl) {
                return <img src={node.imageUrl} alt={node.title} loading="lazy" />;
            }
            return 'No image';
        }
        return '';
    };

    return (
        <div
            className={`canvas-node ${isDragging ? 'dragging' : ''}`}
            style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height
            }}
            onPointerDown={(e) => handlePointerDown(e, node.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => handlePointerUp(e, node.id)}
            onClick={(e) => handleClick(e, node.id)}
        >
            <div className="node-header">
                <span className="node-type-icon">{TYPE_ICONS[node.type]}</span>
                <span className="node-title">{node.title}</span>
            </div>
            <div className="node-preview">
                {getPreview()}
            </div>
        </div>
    );
}
