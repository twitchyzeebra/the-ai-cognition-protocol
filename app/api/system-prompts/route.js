import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Built-in (encrypted) prompt names. User-authored prompts live in the browser's IndexedDB.
export async function GET() {
    try {
        const files = await fs.readdir(path.join(process.cwd(), 'SystemPrompts', 'Encrypted'));
        const prompts = files.filter(f => f.endsWith('.json')).map(f => f.slice(0, -'.json'.length));
        return NextResponse.json(prompts.sort((a, b) => a.localeCompare(b)));
    } catch (error) {
        console.error('Failed to get system prompts:', error);
        return NextResponse.json({ message: 'Failed to get system prompts' }, { status: 500 });
    }
}
