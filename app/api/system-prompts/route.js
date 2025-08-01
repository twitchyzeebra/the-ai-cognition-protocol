import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const encryptedDir = path.join(process.cwd(), 'SystemPrompts', 'Encrypted');
        const files = await fs.readdir(encryptedDir);
        const prompts = files
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace(/\.json$/, ''));
        return NextResponse.json(prompts);
    } catch (error) {
        console.error('Failed to get system prompts:', error);
        return NextResponse.json({ message: 'Failed to get system prompts' }, { status: 500 });
    }
}
