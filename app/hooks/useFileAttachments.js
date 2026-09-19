import { useState, useCallback, useRef } from 'react';
import { VALIDATION_LIMITS, FILE_ATTACHMENTS } from '../../lib/constants';
import { extractDocumentText } from '../utils/extractDocumentText';

const { TEXT_EXTENSIONS, DOCUMENT_EXTENSIONS, IMAGE_EXTENSIONS } = FILE_ATTACHMENTS;
const { MAX_TEXT_SIZE, MAX_IMAGE_SIZE } = VALIDATION_LIMITS;

const extOf = (name) => (name || '').slice((name || '').lastIndexOf('.')).toLowerCase();

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
});

const supportedList = [...TEXT_EXTENSIONS, ...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS].join(', ');

/**
 * useFileAttachments — validation, reading, document text extraction, attachment state.
 *
 * Attachment shape:
 *   { id, name, type: 'text'|'document'|'image', status: 'ready'|'processing'|'error',
 *     content?: string, dataUrl?: string, mimeType: string, meta?: string, error?: string }
 */
export function useFileAttachments() {
    const [attachedFiles, setAttachedFiles] = useState([]);
    const [attachError, setAttachError] = useState('');
    const nextId = useRef(1);

    const patch = (id, changes) =>
        setAttachedFiles(prev => prev.map(f => f.id === id ? { ...f, ...changes } : f));

    const addFiles = useCallback((fileList) => {
        const rejected = [];
        const additions = [];
        const jobs = [];

        for (const file of Array.from(fileList || [])) {
            const ext = extOf(file.name);
            const isImageMime = (file.type || '').startsWith('image/');
            const id = nextId.current++;

            if (TEXT_EXTENSIONS.includes(ext)) {
                if (file.size > MAX_TEXT_SIZE) {
                    rejected.push(`${file.name}: too large (${(file.size / 1024).toFixed(0)}KB, max 2MB)`);
                    continue;
                }
                additions.push({ id, name: file.name, type: 'text', status: 'processing', mimeType: 'text/plain' });
                jobs.push(file.text()
                    .then(content => patch(id, { content, status: 'ready' }))
                    .catch(err => patch(id, { status: 'error', error: err.message })));
            } else if (DOCUMENT_EXTENSIONS.includes(ext)) {
                additions.push({ id, name: file.name, type: 'document', status: 'processing', mimeType: file.type || 'application/octet-stream' });
                jobs.push(extractDocumentText(file)
                    .then(({ text, meta }) => {
                        if (!text.trim()) {
                            patch(id, { status: 'error', error: 'No text found (scanned image PDF?)' });
                        } else {
                            patch(id, { content: text, meta, status: 'ready' });
                        }
                    })
                    .catch(err => patch(id, { status: 'error', error: err.message || 'Extraction failed' })));
            } else if (IMAGE_EXTENSIONS.includes(ext) || (isImageMime && !ext)) {
                if (file.size > MAX_IMAGE_SIZE) {
                    rejected.push(`${file.name}: image too large (${(file.size / (1024 * 1024)).toFixed(1)}MB, max 5MB)`);
                    continue;
                }
                additions.push({ id, name: file.name || 'pasted-image.png', type: 'image', status: 'processing', mimeType: file.type || 'image/png' });
                jobs.push(readAsDataUrl(file)
                    .then(dataUrl => patch(id, { dataUrl, status: 'ready' }))
                    .catch(err => patch(id, { status: 'error', error: err.message })));
            } else {
                rejected.push(`${file.name}: unsupported type`);
            }
        }

        if (additions.length) setAttachedFiles(prev => [...prev, ...additions]);
        setAttachError(rejected.length
            ? `${rejected.join('; ')}. Supported: ${supportedList}`
            : '');
        return Promise.all(jobs);
    }, []);

    const removeFile = useCallback((id) => {
        setAttachedFiles(prev => prev.filter(f => f.id !== id));
    }, []);

    const clearFiles = useCallback(() => {
        setAttachedFiles([]);
        setAttachError('');
    }, []);

    const dismissError = useCallback(() => setAttachError(''), []);

    const readyFiles = attachedFiles.filter(f => f.status === 'ready');
    const isProcessing = attachedFiles.some(f => f.status === 'processing');

    /** <file> blocks for text + extracted document attachments */
    const formatForPrompt = useCallback(() => {
        const textual = readyFiles.filter(f => f.type === 'text' || f.type === 'document');
        if (!textual.length) return '';
        return textual.map(f => `<file name="${f.name}">\n${f.content}\n</file>`).join('\n\n');
    }, [readyFiles]);

    /** base64 image array for the API payload */
    const extractImages = useCallback(() => {
        return readyFiles
            .filter(f => f.type === 'image')
            .map(f => ({ mimeType: f.mimeType, data: f.dataUrl.split(',')[1] }));
    }, [readyFiles]);

    return {
        attachedFiles,
        readyFiles,
        isProcessing,
        attachError,
        dismissError,
        addFiles,
        removeFile,
        clearFiles,
        formatForPrompt,
        extractImages,
    };
}
