import { marked } from 'marked';

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
        if (!url) {
            return null;
        }
        // Handle relative URLs
        const absoluteUrl = url.startsWith('http') ? url : window.location.origin + url;

        const response = await fetch(absoluteUrl);
        if (!response.ok) {
            throw new Error(`Image request failed (${response.status})`);
        }
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
    const safeMarkdown = typeof markdown === 'string' ? markdown : String(markdown ?? '');
    const tokens = marked.lexer(safeMarkdown);

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
        content: tokensToContent(tokens, imageMap),
        styles: {
            h1: {
                fontSize: 22,
                bold: true,
                margin: [0, 20, 0, 10]
            },
            h2: {
                fontSize: 18,
                bold: true,
                margin: [0, 15, 0, 8]
            },
            h3: {
                fontSize: 14,
                bold: true,
                margin: [0, 12, 0, 6]
            },
            h4: {
                fontSize: 12,
                bold: true,
                margin: [0, 10, 0, 5]
            },
            h5: {
                fontSize: 12,
                bold: true,
                margin: [0, 8, 0, 4]
            },
            h6: {
                fontSize: 12,
                bold: true,
                margin: [0, 6, 0, 3]
            },
            paragraph: {
                fontSize: 12,
                margin: [0, 5, 0, 5],
                lineHeight: 1.4
            },
            code: {
                fontSize: 9,
                margin: [0, 5, 0, 5],
                background: '#f5f5f5',
                preserveLeadingSpaces: true
            },
            blockquote: {
                fontSize: 12,
                italics: true,
                margin: [20, 5, 0, 5],
                color: '#555555'
            },
            listItem: {
                fontSize: 12,
                margin: [0, 2, 0, 2]
            },
            link: {
                color: '#0066cc',
                decoration: 'underline'
            },
            tableHeader: {
                bold: true,
                fontSize: 12,
                fillColor: '#f0f0f0'
            },
            tableCell: {
                fontSize: 12
            }
        },
        defaultStyle: {
            font: 'Roboto',
            fontSize: 12
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
        case 'heading':
            return {
                text: parseInlineTokens(token.tokens, imageMap),
                style: `h${token.depth}`
            };

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

            // Regular paragraph with text (images inside will be rendered as fallback text)
            return {
                text: parseInlineTokens(token.tokens, imageMap),
                style: 'paragraph'
            };

        case 'code':
            return {
                text: token.text,
                style: 'code',
                preserveLeadingSpaces: true
            };

        case 'blockquote':
            const blockquoteContent = tokensToContent(token.tokens, imageMap);
            return {
                stack: blockquoteContent,
                style: 'blockquote'
            };

        case 'list':
            return listToElement(token, imageMap);

        case 'table':
            return tableToElement(token, imageMap);

        case 'hr':
            return {
                canvas: [
                    {
                        type: 'line',
                        x1: 0, y1: 0,
                        x2: 515, y2: 0,
                        lineWidth: 1,
                        lineColor: '#cccccc'
                    }
                ],
                margin: [0, 10, 0, 10]
            };

        case 'space':
            return { text: '', margin: [0, 5, 0, 5] };

        case 'html':
            // Skip HTML for now or handle basic cases
            return null;

        case 'text':
            // Block-level text (common in list items)
            // Don't use 'paragraph' style to avoid unwanted margins/line breaks
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
        // Apply styles to each element in the array
        return content.map(item => applyStylesToContent(item, styles));
    } else if (typeof content === 'object') {
        // Merge styles with existing object
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
            // Flatten arrays to avoid nested array structures
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
                fontSize: 12,
                background: '#f5f5f5'
            };

        case 'link':
            return {
                text: parseInlineTokens(token.tokens, imageMap),
                style: 'link',
                link: token.href
            };

        case 'image':
            // Images in inline context (mixed with text) can't be rendered in pdfMake
            // Show fallback text. Block-level images are handled in paragraph case.
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
        // Each list item contains tokens
        const itemContent = tokensToContent(item.tokens, imageMap);

        // If item has multiple elements, wrap in a stack
        // If single element, unwrap it
        if (itemContent.length === 0) {
            return '';
        } else if (itemContent.length === 1) {
            return itemContent[0];
        } else {
            // Multiple elements - wrap in stack to preserve structure
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

        // Preserve original list start number if not starting at 1
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
 */
function tableToElement(token, imageMap) {
    const headers = token.header.map(cell => ({
        text: parseInlineTokens(cell.tokens, imageMap),
        style: 'tableHeader'
    }));

    const rows = token.rows.map(row =>
        row.map(cell => ({
            text: parseInlineTokens(cell.tokens, imageMap),
            style: 'tableCell'
        }))
    );

    return {
        table: {
            headerRows: 1,
            widths: Array(token.header.length).fill('auto'),
            body: [headers, ...rows]
        },
        margin: [0, 5, 0, 10],
        layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#dddddd',
            vLineColor: () => '#dddddd'
        }
    };
}
