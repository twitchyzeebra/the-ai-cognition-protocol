/**
 * Browser-side text extraction for document attachments.
 * Files never leave the browser; only the extracted text is sent with the prompt.
 * Parsers are loaded lazily so they don't bloat the initial bundle.
 */

const ext = (name) => (name || '').slice((name || '').lastIndexOf('.')).toLowerCase();

async function extractPdf(file) {
    const pdfjs = await import('pdfjs-dist');
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
        ).toString();
    }
    const data = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data });
    const doc = await loadingTask.promise;
    const pages = [];
    try {
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            let line = '';
            const lines = [];
            for (const item of content.items) {
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
    return { text: pages.join('\n\n'), meta: `${doc.numPages} page${doc.numPages === 1 ? '' : 's'}` };
}

async function extractDocx(file) {
    const mammoth = await import('mammoth/mammoth.browser');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: result.value || '', meta: 'docx' };
}

async function extractXlsx(file) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheets = wb.SheetNames.map(name => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
        return `--- Sheet: ${name} ---\n${csv.trim()}`;
    });
    return { text: sheets.join('\n\n'), meta: `${wb.SheetNames.length} sheet${wb.SheetNames.length === 1 ? '' : 's'}` };
}

async function extractPptx(file) {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slideFiles = Object.keys(zip.files)
        .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => Number(a.match(/\d+/g).pop()) - Number(b.match(/\d+/g).pop()));
    const parser = new DOMParser();
    const slides = [];
    for (let i = 0; i < slideFiles.length; i++) {
        const xml = await zip.file(slideFiles[i]).async('string');
        const doc = parser.parseFromString(xml, 'application/xml');
        // a:p = paragraph, a:t = text run
        const paragraphs = Array.from(doc.getElementsByTagName('a:p')).map(p =>
            Array.from(p.getElementsByTagName('a:t')).map(t => t.textContent).join('')
        ).filter(Boolean);
        slides.push(`--- Slide ${i + 1} ---\n${paragraphs.join('\n')}`);
    }
    return { text: slides.join('\n\n'), meta: `${slideFiles.length} slide${slideFiles.length === 1 ? '' : 's'}` };
}

/**
 * @param {File} file
 * @returns {Promise<{ text: string, meta: string }>}
 */
export async function extractDocumentText(file) {
    switch (ext(file.name)) {
        case '.pdf': return extractPdf(file);
        case '.docx': return extractDocx(file);
        case '.xlsx':
        case '.xls': return extractXlsx(file);
        case '.pptx': return extractPptx(file);
        default: throw new Error(`No extractor for ${file.name}`);
    }
}
