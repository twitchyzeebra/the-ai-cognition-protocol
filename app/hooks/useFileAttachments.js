import { useState, useCallback, useRef } from 'react';
import { VALIDATION_LIMITS, FILE_ATTACHMENTS } from '../../lib/constants';
import { extractDocumentText } from '../utils/extractDocumentText';
import { extOf } from '../utils/helpers';

const { TEXT_EXTENSIONS, DOCUMENT_EXTENSIONS, IMAGE_EXTENSIONS } = FILE_ATTACHMENTS;
const SUPPORTED = Object.values(FILE_ATTACHMENTS).flat().join(', ');

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
});

// → { type, mimeType, read } for a supported file, or a rejection reason string.
function classify(file) {
    const ext = extOf(file.name);
    if (TEXT_EXTENSIONS.includes(ext)) {
        if (file.size > VALIDATION_LIMITS.MAX_TEXT_SIZE) return `too large (${(file.size / 1024).toFixed(0)}KB, max 2MB)`;
        return { type: 'text', mimeType: 'text/plain', read: async () => ({ content: await file.text() }) };
    }
    if (DOCUMENT_EXTENSIONS.includes(ext)) {
        return {
            type: 'document', mimeType: file.type || 'application/octet-stream', read: async () => {
                const { text, meta } = await extractDocumentText(file);
                if (!text.trim()) throw new Error('No text found (scanned image PDF?)');
                return { content: text, meta };
            }
        };
    }
    if (IMAGE_EXTENSIONS.includes(ext) || (!ext && (file.type || '').startsWith('image/'))) {
        if (file.size > VALIDATION_LIMITS.MAX_IMAGE_SIZE) return `image too large (${(file.size / (1024 * 1024)).toFixed(1)}MB, max 5MB)`;
        return { type: 'image', mimeType: file.type || 'image/png', read: async () => ({ dataUrl: await readAsDataUrl(file) }) };
    }
    return 'unsupported type';
}

/**
 * useFileAttachments — validation, reading, document text extraction, attachment state.
 * Attachment: { id, name, type: 'text'|'document'|'image', status: 'processing'|'ready'|'error',
 *               mimeType, content?, dataUrl?, meta?, error? }
 */
export function useFileAttachments() {
    const [attachedFiles, setAttachedFiles] = useState([]);
    const [attachError, setAttachError] = useState('');
    const nextId = useRef(1);

    const patch = (id, changes) => setAttachedFiles(prev => prev.map(f => (f.id === id ? { ...f, ...changes } : f)));

    const addFiles = useCallback((fileList) => {
        const rejected = [];
        const added = [];
        const jobs = [];
        for (const file of Array.from(fileList || [])) {
            const kind = classify(file);
            if (typeof kind === 'string') {
                rejected.push(`${file.name}: ${kind}`);
                continue;
            }
            const id = nextId.current++;
            added.push({ id, name: file.name || 'pasted-image.png', type: kind.type, status: 'processing', mimeType: kind.mimeType });
            jobs.push(kind.read().then(
                result => patch(id, { ...result, status: 'ready' }),
                err => patch(id, { status: 'error', error: err?.message || 'Extraction failed' })
            ));
        }
        if (added.length) setAttachedFiles(prev => [...prev, ...added]);
        setAttachError(rejected.length ? `${rejected.join('; ')}. Supported: ${SUPPORTED}` : '');
        return Promise.all(jobs);
    }, []);

    const removeFile = useCallback((id) => setAttachedFiles(prev => prev.filter(f => f.id !== id)), []);
    const clearFiles = useCallback(() => { setAttachedFiles([]); setAttachError(''); }, []);
    const dismissError = useCallback(() => setAttachError(''), []);

    return {
        attachedFiles,
        readyFiles: attachedFiles.filter(f => f.status === 'ready'),
        isProcessing: attachedFiles.some(f => f.status === 'processing'),
        attachError, dismissError, addFiles, removeFile, clearFiles
    };
}
