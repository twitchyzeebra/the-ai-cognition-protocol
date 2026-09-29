/**
 * Browser-side text extraction for document attachments.
 * Files never leave the browser; only the extracted text is sent with the prompt.
 * Parsers are loaded lazily so they don't bloat the initial bundle.
 */
import { extOf } from './helpers';

const count = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

async function extractPdf(file) {
    const pdfjs = await import('pdfjs-dist');
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    }
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const doc = await loadingTask.promise;
    const pages = [];
    try {
        for (let i = 1; i <= doc.numPages; i++) {
            const { items } = await (await doc.getPage(i)).getTextContent();
            let line = '';
            const lines = [];
            for (const item of items) {
                if (!('str' in item)) continue;
                line += item.str;
                if (item.hasEOL) { lines.push(line); line = ''; }
            }
            if (line) lines.push(line);
            pages.push(`--- Page ${i} ---\n${lines.join('\n').trim()}`);
        }
    } finally {
        // Release the worker; API differs across pdf.js majors, so guard both forms.
        try { await (loadingTask.destroy?.() ?? doc.destroy?.()); } catch { /* ignore */ }
    }
    return { text: pages.join('\n\n'), meta: count(doc.numPages, 'page') };
}

async function extractDocx(file) {
    const mammoth = await import('mammoth/mammoth.browser');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: result.value || '', meta: 'docx' };
}

async function extractXlsx(file) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheets = wb.SheetNames.map(name => `--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[name]).trim()}`);
    return { text: sheets.join('\n\n'), meta: count(wb.SheetNames.length, 'sheet') };
}

async function extractPptx(file) {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slideNo = (n) => Number(n.match(/\d+/g).pop());
    const slideFiles = Object.keys(zip.files)
        .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => slideNo(a) - slideNo(b));
    const parser = new DOMParser();
    const slides = [];
    for (const [i, name] of slideFiles.entries()) {
        const doc = parser.parseFromString(await zip.file(name).async('string'), 'application/xml');
        // a:p = paragraph, a:t = text run
        const paragraphs = Array.from(doc.getElementsByTagName('a:p'))
            .map(p => Array.from(p.getElementsByTagName('a:t')).map(t => t.textContent).join(''))
            .filter(Boolean);
        slides.push(`--- Slide ${i + 1} ---\n${paragraphs.join('\n')}`);
    }
    return { text: slides.join('\n\n'), meta: count(slideFiles.length, 'slide') };
}

const EXTRACTORS = { '.pdf': extractPdf, '.docx': extractDocx, '.xlsx': extractXlsx, '.xls': extractXlsx, '.pptx': extractPptx };

/** @returns {Promise<{ text: string, meta: string }>} */
export async function extractDocumentText(file) {
    const extract = EXTRACTORS[extOf(file.name)];
    if (!extract) throw new Error(`No extractor for ${file.name}`);
    return extract(file);
}
