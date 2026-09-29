import { marked } from 'marked';

// Visual language mirrors resources.css.
const ACCENT = '#667eea';
const RULE_WIDTH = 515;
const MUTED = { italics: true, color: '#666666' };

let pdfMakePromise = null;

// pdfmake is browser-only and large: load it, with its fonts, on first use.
function loadPdfMake() {
    pdfMakePromise ||= (async () => {
        const pdfMakeModule = await import('pdfmake/build/pdfmake');
        const pdfMake = pdfMakeModule.default || pdfMakeModule;
        // Must load after pdfmake: vfs_fonts registers itself on the global pdfMake. Older builds export { pdfMake: { vfs } }.
        const fonts = await import('pdfmake/build/vfs_fonts');
        const vfs = fonts.default?.pdfMake?.vfs || fonts.pdfMake?.vfs;
        if (vfs) pdfMake.vfs = vfs;
        return pdfMake;
    })().catch(err => { pdfMakePromise = null; throw err; });
    return pdfMakePromise;
}

async function toDataUrl(url) {
    try {
        const res = await fetch(new URL(url, window.location.href));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn(`Failed to load image: ${url}`, error);
        return null;
    }
}

function collectImageUrls(tokens, urls = new Set()) {
    for (const token of tokens) {
        if (token.type === 'image') urls.add(token.href);
        if (token.tokens) collectImageUrls(token.tokens, urls);
        if (token.items) collectImageUrls(token.items, urls);
    }
    return urls;
}

const heading = (fontSize, top, bottom = 7, color = '#2d2d2d') => ({ fontSize, bold: true, margin: [0, top, 0, bottom], color });
const pdfStyles = () => ({
    h1: heading(24, 14, 2, '#1a1a1a'), h2: heading(20, 12), h3: heading(16, 10), h4: heading(15, 8), h5: heading(14, 6), h6: heading(13, 5, 2),
    paragraph: { fontSize: 12, margin: [0, 0, 0, 11], lineHeight: 1.3 },
    listItem: { fontSize: 12, margin: [0, 1, 0, 1], lineHeight: 1.4 },
    link: { color: ACCENT, decoration: 'underline' }
});

const rule = (lineColor, margin) => ({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: RULE_WIDTH, y2: 0, lineWidth: 2, lineColor }], margin });
const padding = (left, right, top, bottom) => ({
    paddingLeft: typeof left === 'function' ? left : () => left, paddingRight: () => right, paddingTop: () => top, paddingBottom: () => bottom
});
const NO_LINES = { hLineWidth: () => 0, vLineWidth: () => 0 };

/** Markdown tokens → pdfMake content array. */
const blocks = (tokens, images) => tokens.flatMap(token => block(token, images) ?? []);

function block(token, images) {
    switch (token.type) {
        case 'heading': {
            const el = { text: inline(token.tokens), style: `h${token.depth}` };
            return token.depth === 1 ? [el, rule(ACCENT, [0, 0, 0, 8])] : el;
        }
        case 'paragraph': {
            const [first] = token.tokens;
            if (token.tokens.length !== 1 || first.type !== 'image') return { text: inline(token.tokens), style: 'paragraph' };
            // Image-only paragraph → block image (or a placeholder if it could not be fetched)
            const data = images.get(first.href);
            return data ? { image: data, width: 500, margin: [0, 10, 0, 10] } : { text: `[Image: ${first.alt || first.href}]`, style: 'paragraph', ...MUTED };
        }
        case 'code': // dark block via a single-cell table
            return {
                table: { widths: ['*'], body: [[{ text: token.text, fontSize: 10.5, color: '#f8f8f2', preserveLeadingSpaces: true, lineHeight: 1.5 }]] },
                layout: { fillColor: () => '#2d2d2d', ...NO_LINES, ...padding(12, 12, 8, 8) },
                margin: [0, 4, 0, 4]
            };
        case 'blockquote': // accent left border + grey background via a two-column table
            return {
                table: { widths: [3, '*'], body: [[{ text: '', fillColor: ACCENT }, { stack: blocks(token.tokens, images), fillColor: '#f0f0f0', color: '#555555', italics: true }]] },
                layout: { ...NO_LINES, ...padding(i => (i === 0 ? 0 : 12), 12, 6, 6) },
                margin: [0, 4, 0, 4]
            };
        case 'list': {
            const items = token.items.map(item => {
                const content = blocks(item.tokens, images);
                return content.length > 1 ? { stack: content, margin: [0, 0, 0, 0] } : content[0] ?? '';
            });
            const list = { [token.ordered ? 'ol' : 'ul']: items, margin: [0, 5, 0, 5], style: 'listItem' };
            if (token.ordered && token.start && token.start !== 1) list.start = token.start;
            return list;
        }
        case 'table': // accent header row, alternating row shading
            return {
                table: {
                    headerRows: 1,
                    widths: token.header.map(() => '*'),
                    body: [
                        token.header.map(cell => ({ text: inline(cell.tokens), bold: true, fontSize: 12, color: '#ffffff' })),
                        ...token.rows.map(row => row.map(cell => ({ text: inline(cell.tokens), fontSize: 12 })))
                    ]
                },
                margin: [0, 8, 0, 10],
                layout: {
                    hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#dddddd', vLineColor: () => '#dddddd',
                    fillColor: (row) => (row === 0 ? ACCENT : row % 2 === 0 ? '#f9f9f9' : null),
                    ...padding(8, 8, 6, 6)
                }
            };
        case 'hr':
            return rule('#a0abe2', [0, 10, 0, 10]);
        case 'text':
            return { text: inline(token.tokens), fontSize: 12, lineHeight: 1.4 };
        default: // 'space' (paragraph separators) and 'html' render nothing
            return null;
    }
}

const withStyle = (content, style) =>
    typeof content === 'string' ? { text: content, ...style }
        : Array.isArray(content) ? content.map(c => withStyle(c, style))
            : { ...content, ...style };

/** Inline tokens (emphasis, links, code…) → pdfMake text fragments. */
const inline = (tokens) => (tokens?.length ? tokens.flatMap(inlineFragment) : '');

function inlineFragment(token) {
    switch (token.type) {
        case 'text': return token.text;
        case 'strong': return withStyle(inline(token.tokens), { bold: true });
        case 'em': return withStyle(inline(token.tokens), { italics: true });
        case 'codespan': return { text: token.text, fontSize: 10.5, background: '#f5f5f5', color: '#d63384' };
        case 'link': return { text: inline(token.tokens), style: 'link', link: token.href };
        case 'image': return { text: `[Image: ${token.alt || token.href}]`, ...MUTED };
        case 'br': return '\n';
        case 'del': return { text: inline(token.tokens), decoration: 'lineThrough' };
        default: return token.text || '';
    }
}

/**
 * Convert markdown to a PDF and download it.
 * @param {string} markdown
 * @param {string} filename
 */
export async function convertMarkdownToPdf(markdown, filename) {
    const pdfMake = await loadPdfMake();
    const tokens = marked.lexer(markdown);
    const images = new Map();
    await Promise.all([...collectImageUrls(tokens)].map(async url => {
        const data = await toDataUrl(url);
        if (data) images.set(url, data);
    }));
    pdfMake.createPdf({
        pageMargins: [40, 40, 40, 40],
        content: blocks(tokens, images),
        styles: pdfStyles(),
        defaultStyle: { font: 'Roboto', fontSize: 12, lineHeight: 1.35 }
    }).download(filename);
}
