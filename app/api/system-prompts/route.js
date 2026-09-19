import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Returns the built-in (encrypted) prompt names. User-authored prompts live in
// the browser's IndexedDB and are merged client-side.
export async function GET() {
    try {
        const encryptedDir = path.join(process.cwd(), 'SystemPrompts', 'Encrypted');
        const files = await fs.readdir(encryptedDir);
        const prompts = files
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace(/\.json$/, ''))
            .sort((a, b) => a.localeCompare(b));
        return NextResponse.json(prompts);
    } catch (error) {
        console.error('Failed to get system prompts:', error);
        return NextResponse.json({ message: 'Failed to get system prompts' }, { status: 500 });
    }
}
