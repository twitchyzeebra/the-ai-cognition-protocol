// Small browser helpers shared by the chat and resources pages.

export async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} responded ${res.status}`);
    return res.json();
}

// Slugs look like "Polished/Some Title"; encode each path segment.
export const resourceUrl = (slug) => `/api/learning-resources/${slug.split('/').map(encodeURIComponent).join('/')}`;

export const extOf = (name = '') => {
    const i = name.lastIndexOf('.');
    return i < 0 ? '' : name.slice(i).toLowerCase();
};

export const safeFilename = (name, fallback) =>
    (name || fallback).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim().slice(0, 120) || fallback;

export function downloadText(text, filename, type = 'text/plain') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
