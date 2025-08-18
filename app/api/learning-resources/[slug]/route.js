import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
    const resolvedParams = await params;
    const slug = resolvedParams.slug;

    if (!slug) {
        return NextResponse.json({ message: 'Slug is required' }, { status: 400 });
    }

    try {
        const filePath = path.join(process.cwd(), 'learning-resources', `${decodeURIComponent(slug)}.md`);
        const content = await fs.readFile(filePath, 'utf8');
        return NextResponse.json({ content });
    } catch (error) {
        if (error.code === 'ENOENT') {
             return NextResponse.json({ message: `Learning resource not found: ${slug}` }, { status: 404 });
        }
        console.error(`Failed to read learning resource "${slug}":`, error);
        return NextResponse.json({ message: 'Failed to read learning resource' }, { status: 500 });
    }
}
