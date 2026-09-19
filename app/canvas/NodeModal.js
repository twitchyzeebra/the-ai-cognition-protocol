'use client';

import { createPortal } from 'react-dom';
import ChatNodeModal from './ChatNodeModal';
import DocumentNodeModal from './DocumentNodeModal';
import ImageNodeModal from './ImageNodeModal';

export default function NodeModal({ node, onClose, onUpdate, onUpdateTitle, onDelete }) {
    if (!node || typeof document === 'undefined') return null;

    const handleUpdate = async (nodeId, changes) => {
        await onUpdate(nodeId, changes);
    };

    const handleDelete = async () => {
        if (window.confirm(`Delete "${node.title}"?`)) {
            await onDelete(node.id);
        }
    };

    const handleDeleteClick = async () => {
        if (window.confirm(`Delete "${node.title}"? This cannot be undone.`)) {
            await onDelete(node.id);
        }
    };

    let ModalContent;
    if (node.type === 'chat') {
        ModalContent = (
            <ChatNodeModal
                node={node}
                onClose={onClose}
                onUpdateTitle={onUpdateTitle}
                onDelete={handleDeleteClick}
            />
        );
    } else if (node.type === 'document') {
        ModalContent = (
            <DocumentNodeModal
                node={node}
                onClose={onClose}
                onUpdate={handleUpdate}
                onDelete={handleDeleteClick}
            />
        );
    } else if (node.type === 'image') {
        ModalContent = (
            <ImageNodeModal
                node={node}
                onClose={onClose}
                onUpdate={handleUpdate}
                onDelete={handleDeleteClick}
            />
        );
    }

    return createPortal(ModalContent, document.body);
}
