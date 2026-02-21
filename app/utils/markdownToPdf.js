import { marked } from 'marked';

const ACCENT_COLOR = '#667eea';
const ACCENT_COLOR_MUTED = '#a0abe2';

// Dynamic imports for pdfMake to avoid SSR issues
let pdfMakeInstance = null;

async function initializePdfMake() {
    if (pdfMakeInstance) return pdfMakeInstance;

    const pdfMake = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');

    // Handle both default and named exports
    const pdfMakeModule = pdfMake.default || pdfMake;
    const vfs = pdfFonts.default?.pdfMake?.vfs || pdfFonts.pdfMake?.vfs;

    if (vfs) {
        pdfMakeModule.vfs = vfs;
    }

    pdfMakeInstance = pdfMakeModule;
    return pdfMakeModule;
}

/**
 * Fetch image and convert to base64 data URI
 */
async function imageUrlToBase64(url) {
    try {
        // Handle relative URLs
        const absoluteUrl = url.startsWith('http') ? url : window.location.origin + url;

        const response = await fetch(absoluteUrl);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn(`Failed to load image: ${url}`, error);
        return null;
    }
}

/**
 * Collect all image URLs from tokens
 */
function collectImageUrls(tokens) {
    const imageUrls = new Set();

    function processToken(token) {
        if (token.type === 'image') {
            imageUrls.add(token.href);
        }
        if (token.tokens) {
            token.tokens.forEach(processToken);
        }
        if (token.items) {
            token.items.forEach(item => {
                if (item.tokens) item.tokens.forEach(processToken);
            });
        }
    }

    tokens.forEach(processToken);
    return Array.from(imageUrls);
}

/**
 * Convert markdown content to a PDF document
 * @param {string} markdown - The markdown content to convert
 * @param {string} filename - The filename for the downloaded PDF
 */
export async function convertMarkdownToPdf(markdown, filename) {
    // Initialize pdfMake with fonts
    const pdfMake = await initializePdfMake();

    // Parse markdown to tokens
    const tokens = marked.lexer(markdown);

    // Pre-fetch all images and convert to base64
    const imageUrls = collectImageUrls(tokens);
    const imageMap = new Map();

    await Promise.all(
        imageUrls.map(async (url) => {
            const base64 = await imageUrlToBase64(url);
            if (base64) {
                imageMap.set(url, base64);
            }
        })
    );

    // Convert tokens to pdfMake document definition
    const docDefinition = {
        pageMargins: [40, 40, 40, 40],
        content: tokensToContent(tokens, imageMap),
        styles: {
            h1: {
                fontSize: 24,
                bold: true,
                margin: [0, 14, 0, 2],
                color: '#1a1a1a'
            },
            h2: {
                fontSize: 20,
                bold: true,
                margin: [0, 12, 0, 7],
                color: '#2d2d2d'
            },
            h3: {
                fontSize: 16,
                bold: true,
                margin: [0, 10, 0, 7],
                color: '#2d2d2d'
            },
            h4: {
                fontSize: 15,
                bold: true,
                margin: [0, 8, 0, 7],
                color: '#2d2d2d'
            },
            h5: {
                fontSize: 14,
                bold: true,
                margin: [0, 6, 0, 7],
                color: '#2d2d2d'
            },
            h6: {
                fontSize: 13,
                bold: true,
                margin: [0, 5, 0, 2],
                color: '#2d2d2d'
            },
            paragraph: {
                fontSize: 12,
                margin: [0, 0, 0, 11],
                lineHeight: 1.3
            },
            code: {
                fontSize: 10.5,
                margin: [0, 4, 0, 4],
                preserveLeadingSpaces: true
            },
            blockquote: {
                fontSize: 12,
                italics: true,
                margin: [0, 4, 0, 4],
                color: '#424242'
            },
            listItem: {
                fontSize: 12,
                margin: [0, 1, 0, 1],
                lineHeight: 1.4
            },
            link: {
                color: ACCENT_COLOR,
                decoration: 'underline'
            },
            tableHeader: {
                bold: true,
                fontSize: 12,
                color: '#ffffff'
            },
            tableCell: {
                fontSize: 12
            }
        },
        defaultStyle: {
            font: 'Roboto',
            fontSize: 12,
            lineHeight: 1.35
        }
    };

    // Generate and download PDF
    pdfMake.createPdf(docDefinition).download(filename);
}

/**
 * Convert marked tokens to pdfMake content array
 */
function tokensToContent(tokens, imageMap = new Map()) {
    const content = [];

    for (const token of tokens) {
        const element = tokenToElement(token, imageMap);
        if (element) {
            if (Array.isArray(element)) {
                content.push(...element);
            } else {
                content.push(element);
            }
        }
    }

    return content;
}

/**
 * Convert a single token to a pdfMake element
 */
function tokenToElement(token, imageMap) {
    switch (token.type) {
        case 'heading': {
            const headingElement = {
                text: parseInlineTokens(token.tokens, imageMap),
                style: `h${token.depth}`
            };
            // h1 gets a purple bottom border like resources.css
            if (token.depth === 1) {
                return [
                    headingElement,
                    {
                        canvas: [{
                            type: 'line',
                            x1: 0, y1: 0,
                            x2: 515, y2: 0,
                            lineWidth: 2,
                            lineColor: ACCENT_COLOR
                        }],
                        margin: [0, 0, 0, 8]
                    }
                ];
            }
            return headingElement;
        }

        case 'paragraph':
            // Check if paragraph contains only an image
            if (token.tokens.length === 1 && token.tokens[0].type === 'image') {
                // Extract image as block-level element
                const imageToken = token.tokens[0];
                const base64Image = imageMap?.get(imageToken.href);
                if (base64Image) {
                    return {
                        image: base64Image,
                        width: 500,
                        margin: [0, 10, 0, 10]
                    };
                } else {
                    return {
                        text: `[Image: ${imageToken.alt || imageToken.href}]`,
                        style: 'paragraph',
                        italics: true,
                        color: '#666666'
                    };
                }
            }

            // Regular paragraph with text
            return {
                text: parseInlineTokens(token.tokens, imageMap),
                style: 'paragraph'
            };

        // Dark background code block via single-cell table with fillColor
        case 'code':
            return {
                table: {
                    widths: ['*'],
                    body: [[{
                        text: token.text,
                        fontSize: 10.5,
                        color: '#f8f8f2',
                        preserveLeadingSpaces: true,
                        lineHeight: 1.5
                    }]]
                },
                layout: {
                    fillColor: () => '#2d2d2d',
                    hLineWidth: () => 0,
                    vLineWidth: () => 0,
                    paddingLeft: () => 12,
                    paddingRight: () => 12,
                    paddingTop: () => 8,
                    paddingBottom: () => 8
                },
                margin: [0, 4, 0, 4]
            };

        // Purple left border + gray background via 2-column table
        case 'blockquote': {
            const blockquoteContent = tokensToContent(token.tokens, imageMap);
            return {
                table: {
                    widths: [3, '*'],
                    body: [[
                        { text: '', fillColor: ACCENT_COLOR },
                        {
                            stack: blockquoteContent,
                            fillColor: '#f0f0f0',
                            color: '#555555',
                            italics: true
                        }
                    ]]
                },
                layout: {
                    hLineWidth: () => 0,
                    vLineWidth: () => 0,
                    paddingLeft: (i) => i === 0 ? 0 : 12,
                    paddingRight: () => 12,
                    paddingTop: () => 6,
                    paddingBottom: () => 6
                },
                margin: [0, 4, 0, 4]
            };
        }

        case 'list':
            return listToElement(token, imageMap);

        case 'table':
            return tableToElement(token, imageMap);

        case 'hr':
            return {
                canvas: [{
                    type: 'line',
                    x1: 0, y1: 0,
                    x2: 515, y2: 0,
                    lineWidth: 2,
                    lineColor: ACCENT_COLOR_MUTED
                }],
                margin: [0, 10, 0, 10]
            };

        case 'space':
            // Blank lines in markdown are paragraph separators, not extra spacing.
            // CSS collapses them; we match that by emitting nothing.
            return null;

        case 'html':
            return null;

        case 'text':
            return {
                text: parseInlineTokens(token.tokens, imageMap),
                fontSize: 12,
                lineHeight: 1.4
            };

        default:
            return null;
    }
}

/**
 * Apply style properties to inline content
 * Handles the case where content is a string, object, or array
 */
function applyStylesToContent(content, styles) {
    if (typeof content === 'string') {
        return { text: content, ...styles };
    } else if (Array.isArray(content)) {
        return content.map(item => applyStylesToContent(item, styles));
    } else if (typeof content === 'object') {
        return { ...content, ...styles };
    }
    return content;
}

/**
 * Parse inline tokens (emphasis, strong, links, etc.)
 */
function parseInlineTokens(tokens, imageMap) {
    if (!tokens || tokens.length === 0) return '';

    const textElements = [];

    for (const token of tokens) {
        const element = inlineTokenToElement(token, imageMap);
        if (element !== null) {
            if (Array.isArray(element)) {
                textElements.push(...element);
            } else {
                textElements.push(element);
            }
        }
    }

    return textElements;
}

/**
 * Convert inline token to text element
 */
function inlineTokenToElement(token, imageMap) {
    switch (token.type) {
        case 'text':
            return token.text;

        case 'strong':
            const strongContent = parseInlineTokens(token.tokens, imageMap);
            return applyStylesToContent(strongContent, { bold: true });

        case 'em':
            const emContent = parseInlineTokens(token.tokens, imageMap);
            return applyStylesToContent(emContent, { italics: true });

        case 'codespan':
            return {
                text: token.text,
                fontSize: 10.5,
                background: '#f5f5f5',
                color: '#d63384'
            };

        case 'link':
            return {
                text: parseInlineTokens(token.tokens, imageMap),
                style: 'link',
                link: token.href
            };

        case 'image':
            return {
                text: `[Image: ${token.alt || token.href}]`,
                italics: true,
                color: '#666666'
            };

        case 'br':
            return '\n';

        case 'del':
            return {
                text: parseInlineTokens(token.tokens, imageMap),
                decoration: 'lineThrough'
            };

        default:
            return token.text || '';
    }
}

/**
 * Convert list token to pdfMake element
 */
function listToElement(token, imageMap) {
    const items = token.items.map(item => {
        const itemContent = tokensToContent(item.tokens, imageMap);

        if (itemContent.length === 0) {
            return '';
        } else if (itemContent.length === 1) {
            return itemContent[0];
        } else {
            return {
                stack: itemContent,
                margin: [0, 0, 0, 0]
            };
        }
    });

    if (token.ordered) {
        const listConfig = {
            ol: items,
            margin: [0, 5, 0, 5],
            style: 'listItem'
        };

        if (token.start && token.start !== 1) {
            listConfig.start = token.start;
        }

        return listConfig;
    } else {
        return {
            ul: items,
            margin: [0, 5, 0, 5],
            style: 'listItem'
        };
    }
}

/**
 * Convert table token to pdfMake element
 * Purple headers with white text, alternating row colors
 */
function tableToElement(token, imageMap) {
    const headers = token.header.map(cell => ({
        text: parseInlineTokens(cell.tokens, imageMap),
        bold: true,
        fontSize: 12,
        color: '#ffffff'
    }));

    const rows = token.rows.map(row =>
        row.map(cell => ({
            text: parseInlineTokens(cell.tokens, imageMap),
            fontSize: 12
        }))
    );

    return {
        table: {
            headerRows: 1,
            widths: Array(token.header.length).fill('*'),
            body: [headers, ...rows]
        },
        margin: [0, 8, 0, 10],
        layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#dddddd',
            vLineColor: () => '#dddddd',
            fillColor: (rowIndex) => {
                if (rowIndex === 0) return ACCENT_COLOR;
                return rowIndex % 2 === 0 ? '#f9f9f9' : null;
            },
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6
        }
    };
}
