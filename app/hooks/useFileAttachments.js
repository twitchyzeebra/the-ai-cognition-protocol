import { useState, useCallback } from 'react';
import { VALIDATION_LIMITS, FILE_ATTACHMENTS } from '../../lib/constants';

const { TEXT_EXTENSIONS, IMAGE_EXTENSIONS } = FILE_ATTACHMENTS;
const { MAX_TEXT_SIZE, MAX_IMAGE_SIZE } = VALIDATION_LIMITS;

/**
 * useFileAttachments — handles file validation, reading, and attachment state.
 *
 * @returns {{
 *   attachedFiles: Array<{ name: string, content?: string, dataUrl?: string, mimeType: string, type: 'text'|'image' }>,
 *   addFiles: (fileList: FileList|File[]) => void,
 *   removeFile: (index: number) => void,
 *   clearFiles: () => void,
 *   formatForPrompt: () => string,
 *   extractImages: () => Array<{ mimeType: string, data: string }>,
 * }}
 */
export function useFileAttachments() {
    const [attachedFiles, setAttachedFiles] = useState([]);

    const addFiles = useCallback((fileList) => {
        const readPromises = [];
        for (const file of fileList) {
            const ext = (file.name || '').slice(file.name.lastIndexOf('.')).toLowerCase();
            if (TEXT_EXTENSIONS.includes(ext)) {
                if (file.size > MAX_TEXT_SIZE) {
                    alert(`File too large: ${file.name} (${(file.size / 1024).toFixed(1)}KB). Max 2MB.`);
                    continue;
                }
                readPromises.push(
                    file.text().then(content => ({ name: file.name, content, type: 'text', mimeType: 'text/plain' }))
                );
            } else if (IMAGE_EXTENSIONS.includes(ext)) {
                if (file.size > MAX_IMAGE_SIZE) {
                    alert(`Image too large: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max 5MB.`);
                    continue;
                }
                readPromises.push(new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({
                        name: file.name,
                        dataUrl: reader.result,
                        mimeType: file.type || 'image/png',
                        type: 'image'
                    });
                    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
                    reader.readAsDataURL(file);
                }));
            } else {
                alert(`Unsupported file type: ${file.name}. Supported: .txt, .md, .png, .jpg, .jpeg, .gif, .webp`);
            }
        }
        if (readPromises.length === 0) return;
        Promise.all(readPromises).then(results => {
            setAttachedFiles(prev => [...prev, ...results]);
        });
    }, []);

    const removeFile = useCallback((index) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    const clearFiles = useCallback(() => {
        setAttachedFiles([]);
    }, []);

    /** Returns <file> XML blocks for text attachments, used in the prompt */
    const formatForPrompt = useCallback(() => {
        const textFiles = attachedFiles.filter(f => f.type === 'text');
        if (!textFiles.length) return '';
        return textFiles.map(f =>
            `<file name="${f.name}">\n${f.content}\n</file>`
        ).join('\n\n');
    }, [attachedFiles]);

    /** Returns base64 image array for the API payload */
    const extractImages = useCallback(() => {
        return attachedFiles
            .filter(f => f.type === 'image')
            .map(f => {
                const base64 = f.dataUrl.split(',')[1];
                return { mimeType: f.mimeType, data: base64 };
            });
    }, [attachedFiles]);

    return {
        attachedFiles,
        addFiles,
        removeFile,
        clearFiles,
        formatForPrompt,
        extractImages,
    };
}
